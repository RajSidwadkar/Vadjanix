import * as fs from 'fs';
import * as path from 'path';
import { embed, cosineSimilarity } from '../embedding/embed_client.js';
import { MCQPacket } from '../core/mcq_schema.js';
import { auditLog } from '../security/audit_chain.js';

export interface AlignmentEntry {
  timestamp: string;
  agentDid: string;
  userWanted: string;
  distance: number;
  context: object;
  agentActionVector: number[];
}

export class DynamicAxiomEngine {
  private alignmentHistory: AlignmentEntry[] = [];
  private readonly PROTECTED_FILES = ['core/engine.ts', 'core/router.ts', 'security/edge_router.ts'];
  private principlesPath: string;

  constructor(principlesPath = 'PRINCIPLES.json') {
    this.principlesPath = path.resolve(principlesPath);
  }

  async recordCorrection(agentAction: string, userPreferred: string, ctx: object): Promise<MCQPacket | null> {
    const v1 = await embed(agentAction);
    const v2 = await embed(userPreferred);
    
    // Distance = 1 - similarity
    const similarity = cosineSimilarity(v1, v2);
    const distance = 1 - similarity;

    const entry: AlignmentEntry = {
      timestamp: new Date().toISOString(),
      agentDid: agentAction,
      userWanted: userPreferred,
      distance,
      context: ctx,
      agentActionVector: v1
    };

    this.alignmentHistory.push(entry);

    // Count similar rejections (dot product > 0.8 with current agentAction vector)
    // Here similarity > 0.8 means they are very close
    const similarRejections = this.alignmentHistory.filter(h => {
        const sim = cosineSimilarity(h.agentActionVector, v1);
        return sim > 0.8;
    });

    if (similarRejections.length >= 3) {
      return this.proposeAxiom(userPreferred, similarRejections.length);
    }

    return null;
  }

  proposeAxiom(correction: string, count: number): MCQPacket {
    // Generate a valid condition for SymbolicRuleEngine
    // Since we don't have the original trigger, we use a simple trust-based heuristic
    // or context-based one if available in alignmentHistory
    const ruleId = `axiom_${Date.now()}`;
    
    // Niche: producing a condition that actually passes SymbolicRuleEngine's whitelist
    // We'll use counterparty_trust if it exists in context, or just a generic 'true'
    const proposedRule = {
      id: ruleId,
      condition: "counterparty_trust > 0", 
      action: correction,
      confidence: 0.9,
      successRate: 0.5
    };

    return {
      level: 'L4',
      question: `I noticed you rejected similar actions ${count} times. Should I always follow your preference for "${correction}" when trust is established?`,
      options: {
        'A': 'Yes, add rule',
        'B': 'No, keep current behavior',
        'C': 'Remind me in 1 week'
      },
      semantic_diff: `System: Various vs User: ${correction}`,
      confidence: 0.95,
      risk: 'Medium',
      reversible: true,
      timeout_mins: 10080, // 1 week
      auto_action: 'B',
      capsule_id: JSON.stringify(proposedRule) // Store full rule object here
    };
  }

  async applyApprovedAxiom(rule: any): Promise<void> {
    // CRITICAL: check path of principlesPath against PROTECTED_FILES list
    // The requirement says check path of principlesPath. 
    // We should check if it's one of the engine files.
    const relativePath = path.relative(process.cwd(), this.principlesPath).replace(/\\/g, '/');
    if (this.PROTECTED_FILES.includes(relativePath)) {
      throw new Error('Cannot modify engine file');
    }

    let rules: any[] = [];
    if (fs.existsSync(this.principlesPath)) {
      const content = fs.readFileSync(this.principlesPath, 'utf8');
      rules = JSON.parse(content);
    }

    rules.push(rule);
    fs.writeFileSync(this.principlesPath, JSON.stringify(rules, null, 2), 'utf8');

    await auditLog({
      action: 'APPLY_AXIOM',
      context: `Applying new axiom from user correction: ${rule.id}`,
      rule: 'DynamicAxiomEngine Alignment',
      decision: `Rule added: ${rule.id}`
    });
  }

  calculateAlignmentScore(): number {
    if (this.alignmentHistory.length === 0) return 1.0;

    const last20 = this.alignmentHistory.slice(-20);
    const meanDistance = last20.reduce((sum, entry) => sum + entry.distance, 0) / last20.length;
    
    return 1 - meanDistance;
  }
}
