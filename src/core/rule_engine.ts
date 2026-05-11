import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

/**
 * Context type: { counterparty_trust?: number, offer?: number, minimum_rate?: number,
 *                 contactCategory?: string, [key: string]: any }
 */
export interface Context {
  counterparty_trust?: number;
  offer?: number;
  minimum_rate?: number;
  contactCategory?: string;
  [key: string]: any;
}

/**
 * Interface Rule { id: string, condition: (ctx: Context) => boolean, action: string,
 *                  confidence: number, successRate: number, contactCategoryRequired?: string }
 */
export interface Rule {
  id: string;
  condition: (ctx: Context) => boolean;
  action: string;
  confidence: number;
  successRate: number;
  contactCategoryRequired?: string;
}

/**
 * Internal storage interface for JSON persistence
 */
const StoredRuleSchema = z.object({
  id: z.string(),
  condition: z.string(),
  action: z.string(),
  confidence: z.number(),
  successRate: z.number().optional(),
  success_rate: z.number().optional(),
  contactCategoryRequired: z.string().optional()
});

type StoredRule = z.infer<typeof StoredRuleSchema>;

export interface EvaluationResult {
  action: string;
  ruleId: string;
  confidence: number;
  source: 'symbolic_rule';
}

export class SymbolicRuleEngine {
  private rules: Rule[] = [];
  private rawRules: StoredRule[] = [];
  private principlesPath: string;

  constructor(principlesPath = 'PRINCIPLES.json') {
    this.principlesPath = path.resolve(principlesPath);
    this._loadRules();
  }

  /**
   * _loadRules(): load from PRINCIPLES.json, compile conditions
   */
  private _loadRules(): void {
    try {
      if (fs.existsSync(this.principlesPath)) {
        const content = fs.readFileSync(this.principlesPath, 'utf8');
        const parsed = JSON.parse(content);
        const validated = z.array(StoredRuleSchema).parse(parsed);

        this.rawRules = validated;
        this.rules = validated.map(raw => ({
          id: raw.id,
          action: raw.action,
          confidence: raw.confidence,
          successRate: raw.successRate ?? raw.success_rate ?? 0.5,
          contactCategoryRequired: raw.contactCategoryRequired,
          condition: this.compileCondition(raw.condition)
        }));
      } else {
        this.rules = [];
        this.rawRules = [];
      }
    } catch (error) {
      console.error(`[SymbolicRuleEngine] Error loading rules:`, error);
      this.rules = [];
      this.rawRules = [];
    }
  }

  private _saveRules(): void {
    try {
      // Sync rawRules with current success rates
      this.rawRules.forEach(raw => {
        const rule = this.rules.find(r => r.id === raw.id);
        if (rule) {
          raw.successRate = rule.successRate;
          // Keep snake_case for compatibility if it was there
          if (raw.success_rate !== undefined) raw.success_rate = rule.successRate;
        }
      });
      fs.writeFileSync(this.principlesPath, JSON.stringify(this.rawRules, null, 2), 'utf8');
    } catch (error) {
      console.error(`[SymbolicRuleEngine] Error saving rules:`, error);
    }
  }

  /**
   * compileCondition(conditionStr: string): (ctx: Context) => boolean
   * SAFE condition builder. Whitelist ONLY: numbers, spaces, operators (<>=!&|)
   * Replace field names with ctx values for safe evaluation.
   */
  public compileCondition(conditionStr: string): (ctx: Context) => boolean {
    // Whitelist check: strictly numbers, spaces, operators, and alphanumeric for field names
    // Note: dots and underscores are essential for Vadjanix field names
    const validPattern = /^[a-zA-Z0-9\s<>=!&|_.]+$/;
    if (!validPattern.test(conditionStr)) {
      throw new Error(`Invalid characters in condition: ${conditionStr}`);
    }

    // Replace field names with ctx access. 
    // Words that are not numbers and not reserved keywords (true/false) are treated as ctx keys.
    const processedCondition = conditionStr.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g, (match) => {
      if (['true', 'false', 'null', 'undefined'].includes(match)) return match;
      if (!isNaN(Number(match))) return match;
      return `ctx['${match}']`;
    });

    try {
      // Create a scoped function. Never use raw eval() on untrusted strings.
      // The processedCondition now contains only ctx access and whitelisted operators/literals.
      return new Function('ctx', `try { return !!(${processedCondition}); } catch { return false; }`) as (ctx: Context) => boolean;
    } catch (e) {
      return () => false;
    }
  }

  /**
   * evaluate(ctx: Context): EvaluationResult | null
   * Sort rules by successRate DESC. First matching condition wins.
   * CRITICAL: if ctx.contactCategory === 'protected' -> return 'escalate_to_owner' always
   */
  public evaluate(ctx: Context): EvaluationResult | null {
    // CRITICAL: Highest priority check
    if (ctx.contactCategory === 'protected') {
      return {
        action: 'escalate_to_owner',
        ruleId: 'protected_contact_override',
        confidence: 1.0,
        source: 'symbolic_rule'
      };
    }

    // Sort rules by successRate DESC
    const sortedRules = [...this.rules].sort((a, b) => b.successRate - a.successRate);

    for (const rule of sortedRules) {
      // Respect contactCategoryRequired if present
      if (rule.contactCategoryRequired && rule.contactCategoryRequired !== ctx.contactCategory) {
        continue;
      }

      if (rule.condition(ctx)) {
        return {
          action: rule.action,
          ruleId: rule.id,
          confidence: rule.confidence,
          source: 'symbolic_rule'
        };
      }
    }

    return null;
  }

  /**
   * updateSuccessRate(ruleId: string, outcome: 'success' | 'failure'): void
   * Bayesian update: alpha = 0.1
   * success -> rate += alpha * (1 - rate)
   * failure -> rate -= alpha * rate
   */
  public updateSuccessRate(ruleId: string, outcome: 'success' | 'failure'): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return;

    const alpha = 0.1;
    if (outcome === 'success') {
      rule.successRate += alpha * (1 - rule.successRate);
    } else {
      rule.successRate -= alpha * rule.successRate;
    }

    this._saveRules();
  }
}
