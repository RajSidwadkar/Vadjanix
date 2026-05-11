import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicAxiomEngine } from '../src/agent/axiom_engine.js';
import * as embedClient from '../src/embedding/embed_client.js';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('../src/embedding/embed_client.js', () => ({
  embed: vi.fn(),
  cosineSimilarity: vi.fn()
}));

vi.mock('../src/memory/audit.js', () => ({
  logDecision: vi.fn().mockResolvedValue(undefined)
}));

describe('DynamicAxiomEngine', () => {
  const TEST_PRINCIPLES = 'TEST_AXIOM_PRINCIPLES.json';

  beforeEach(() => {
    if (fs.existsSync(TEST_PRINCIPLES)) fs.unlinkSync(TEST_PRINCIPLES);
    vi.clearAllMocks();
  });

  it('recordCorrection() 3x with same pattern -> returns MCQ packet', async () => {
    const engine = new DynamicAxiomEngine(TEST_PRINCIPLES);
    
    // Mock similarity
    // Same pattern means similarity > 0.8
    (embedClient.embed as any).mockResolvedValue([0.1, 0.2]);
    (embedClient.cosineSimilarity as any).mockReturnValue(0.9);

    await engine.recordCorrection('action 1', 'better 1', {});
    await engine.recordCorrection('action 1', 'better 1', {});
    const packet = await engine.recordCorrection('action 1', 'better 1', {});

    expect(packet).not.toBeNull();
    expect(packet?.level).toBe('L4');
    expect(packet?.question).toContain('3 times');
  });

  it('applyApprovedAxiom() throws on protected file path', async () => {
    // core/engine.ts is a protected file
    const engine = new DynamicAxiomEngine('core/engine.ts');
    const rule = { id: 'test' };

    await expect(engine.applyApprovedAxiom(rule)).rejects.toThrow('Cannot modify engine file');
  });

  it('calculateAlignmentScore() = 1.0 when no corrections', () => {
    const engine = new DynamicAxiomEngine(TEST_PRINCIPLES);
    expect(engine.calculateAlignmentScore()).toBe(1.0);
  });

  it('calculateAlignmentScore() reflects mean distance', async () => {
    const engine = new DynamicAxiomEngine(TEST_PRINCIPLES);
    
    (embedClient.embed as any).mockResolvedValue([0.1, 0.2]);
    // distance = 1 - 0.8 = 0.2
    (embedClient.cosineSimilarity as any).mockReturnValue(0.8);

    await engine.recordCorrection('a', 'b', {});
    await engine.recordCorrection('a', 'b', {});

    // Mean distance = 0.2
    // Alignment = 1 - 0.2 = 0.8
    expect(engine.calculateAlignmentScore()).toBeCloseTo(0.8);
  });
});
