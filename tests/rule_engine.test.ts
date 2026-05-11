import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SymbolicRuleEngine } from '../src/core/rule_engine.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PRINCIPLES_PATH = 'TEST_PRINCIPLES.json';

describe('SymbolicRuleEngine', () => {
  beforeEach(() => {
    const initialRules = [
      {
        id: 'low_trust_block',
        condition: 'counterparty_trust < 0.3',
        action: 'escalate_to_owner',
        confidence: 0.95,
        successRate: 0.9
      },
      {
        id: 'high_offer_accept',
        condition: 'offer > 500',
        action: 'accept_deal',
        confidence: 0.8,
        successRate: 0.7
      }
    ];
    fs.writeFileSync(TEST_PRINCIPLES_PATH, JSON.stringify(initialRules, null, 2));
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PRINCIPLES_PATH)) {
      fs.unlinkSync(TEST_PRINCIPLES_PATH);
    }
  });

  it('should return escalate_to_owner for protected contact regardless of rules', () => {
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    const result = engine.evaluate({
      contactCategory: 'protected',
      counterparty_trust: 0.9,
      offer: 1000
    });
    expect(result).not.toBeNull();
    expect(result?.action).toBe('escalate_to_owner');
    expect(result?.ruleId).toBe('protected_contact_override');
  });

  it('should evaluate rules based on successRate priority', () => {
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    const result = engine.evaluate({
      counterparty_trust: 0.2,
      offer: 1000
    });
    // low_trust_block matches (0.2 < 0.3) and has higher successRate (0.9 vs 0.7)
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('low_trust_block');
    expect(result?.action).toBe('escalate_to_owner');
  });

  it('should update successRate toward 1.0 on success', () => {
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    engine.updateSuccessRate('high_offer_accept', 'success');

    const updatedData = JSON.parse(fs.readFileSync(TEST_PRINCIPLES_PATH, 'utf8'));
    const updatedRule = updatedData.find((r: any) => r.id === 'high_offer_accept');
    
    // Bayesian update check: 0.7 + 0.1 * (1 - 0.7) = 0.73
    expect(updatedRule.successRate).toBeCloseTo(0.73);
  });

  it('should update successRate toward 0.0 on failure', () => {
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    engine.updateSuccessRate('low_trust_block', 'failure');

    const updatedData = JSON.parse(fs.readFileSync(TEST_PRINCIPLES_PATH, 'utf8'));
    const updatedRule = updatedData.find((r: any) => r.id === 'low_trust_block');
    
    // Bayesian update check: 0.9 - 0.1 * 0.9 = 0.81
    expect(updatedRule.successRate).toBeCloseTo(0.81);
  });

  it('should handle complex conditions correctly', () => {
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    const condition = engine.compileCondition('counterparty_trust < 0.5 && offer > 100');
    
    expect(condition({ counterparty_trust: 0.4, offer: 150 })).toBe(true);
    expect(condition({ counterparty_trust: 0.6, offer: 150 })).toBe(false);
    expect(condition({ counterparty_trust: 0.4, offer: 50 })).toBe(false);
  });

  it('should respect contactCategoryRequired', () => {
    const customRules = [
      {
        id: 'premium_only',
        condition: 'offer > 100',
        action: 'accept_premium',
        confidence: 1.0,
        successRate: 1.0,
        contactCategoryRequired: 'premium'
      }
    ];
    fs.writeFileSync(TEST_PRINCIPLES_PATH, JSON.stringify(customRules, null, 2));
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);

    // Should NOT match for non-premium
    expect(engine.evaluate({ offer: 200, contactCategory: 'regular' })).toBeNull();
    
    // SHOULD match for premium
    const result = engine.evaluate({ offer: 200, contactCategory: 'premium' });
    expect(result?.action).toBe('accept_premium');
  });

  it('should handle missing successRate by defaulting to 0.5', () => {
    const rulesWithNoRate = [
      {
        id: 'new_rule',
        condition: 'true',
        action: 'test',
        confidence: 1.0
      }
    ];
    fs.writeFileSync(TEST_PRINCIPLES_PATH, JSON.stringify(rulesWithNoRate, null, 2));
    const engine = new SymbolicRuleEngine(TEST_PRINCIPLES_PATH);
    const result = engine.evaluate({});
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('new_rule');
  });
});
