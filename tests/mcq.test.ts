import { describe, it, expect, vi } from 'vitest';
import { classifyAction, formatWhatsAppMCQ } from '../src/agent/mcq.js';
import { handleReply } from '../src/agent/mcq_handler.js';
import { getAutonomyLevel } from '../src/agent/autonomy_classifier.js';
import fs from 'node:fs';

vi.mock('node:fs');

describe('MCQ Autonomy Logic', () => {
  describe('classifyAction', () => {
    it('should return L4 for protected contacts regardless of confidence', () => {
      const level = classifyAction('test-action', 0.99, 0.99, 'protected');
      expect(level).toBe('L4');
    });

    it('should return L1 for high confidence and trust', () => {
      const level = classifyAction('test-action', 0.95, 0.85, 'normal');
      expect(level).toBe('L1');
    });

    it('should return L2 for medium-high confidence and trust', () => {
      const level = classifyAction('test-action', 0.8, 0.7, 'normal');
      expect(level).toBe('L2');
    });

    it('should return L3 for medium confidence', () => {
      const level = classifyAction('test-action', 0.6, 0.5, 'normal');
      expect(level).toBe('L3');
    });

    it('should return L4 for low confidence', () => {
      const level = classifyAction('test-action', 0.4, 0.4, 'normal');
      expect(level).toBe('L4');
    });
  });

  describe('getAutonomyLevel', () => {
    it('should identify protected contacts and return L4', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        protected: ['protected-jid']
      }));

      const level = getAutonomyLevel('protected-jid', 'test', 0.99, 0.99);
      expect(level).toBe('L4');
    });
  });

  describe('formatWhatsAppMCQ', () => {
    it('should format L3 correctly with timeout', () => {
      const packet = {
        level: 'L3' as const,
        question: 'Should I do this?',
        options: { A: 'Yes', B: 'No' },
        semantic_diff: '+ action',
        confidence: 0.6,
        risk: 'Medium' as const,
        reversible: true,
        timeout_mins: 10
      };
      const formatted = formatWhatsAppMCQ(packet);
      expect(formatted).toContain('[L3 Decision Required]');
      expect(formatted).toContain('Auto-proceeds in 10min');
    });

    it('should format L4 correctly', () => {
      const packet = {
        level: 'L4' as const,
        question: 'Action required?',
        options: { A: 'Execute', B: 'Cancel' },
        semantic_diff: '+ critical action',
        confidence: 0.4,
        risk: 'High' as const,
        reversible: false,
        timeout_mins: 0
      };
      const formatted = formatWhatsAppMCQ(packet);
      expect(formatted).toContain('[L4 Decision Required]');
      expect(formatted).toContain('Waiting for your reply.');
    });
  });

  describe('handleReply', () => {
    const packet = {
      level: 'L4' as const,
      question: 'Q',
      options: { A: 'ActionA', B: 'ActionB' },
      semantic_diff: 'diff',
      confidence: 0.5,
      risk: 'Low' as const,
      reversible: true,
      timeout_mins: 0
    };

    it('should return action for valid reply', () => {
      expect(handleReply('A', packet)).toBe('ActionA');
      expect(handleReply('b', packet)).toBe('ActionB');
    });

    it('should return undefined for invalid reply', () => {
      expect(handleReply('C', packet)).toBeUndefined();
      expect(handleReply('something else', packet)).toBeUndefined();
    });
  });
});
