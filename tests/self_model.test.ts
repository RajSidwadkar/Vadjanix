import { describe, it, expect, vi } from 'vitest';
import { AgentSelfModel } from '../src/core/self_model.js';
import { GlobalWorkspace } from '../src/agent/global_workspace.js';
import * as fs from 'fs';

// Mock fs to avoid ESM spy issues
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  default: {
    writeFileSync: vi.fn()
  }
}));

describe('AgentSelfModel', () => {
  it('updateFromEpisode updates stats and affects confidence', () => {
    const model = new AgentSelfModel();
    const initialConfidence = model.affectiveState.confidence;
    
    model.updateFromEpisode('coding', 'success', 0.9);
    expect(model.capabilities.get('coding')?.successes).toBe(1);
    expect(model.affectiveState.confidence).toBeGreaterThan(initialConfidence);
    
    model.updateFromEpisode('coding', 'failure', 0.5);
    expect(model.capabilities.get('coding')?.failures).toBe(1);
  });

  it('detects bias after 5 failures in same domain', () => {
    const model = new AgentSelfModel();
    for (let i = 0; i < 5; i++) {
      model.updateFromEpisode('math', 'failure', 0.8);
    }
    expect(model.knownBiases).toContain('Low reliability in math');
  });

  it('shouldEscalate works based on combined confidence and domain rate', () => {
    const model = new AgentSelfModel();
    // Unknown domain, rate = 0.5. combined = 0.6*0.9 + 0.4*0.5 = 0.54 + 0.2 = 0.74 > 0.5 => false
    expect(model.shouldEscalate('unknown', 0.9)).toBe(false);
    
    // Low confidence: combined = 0.6*0.2 + 0.4*0.5 = 0.12 + 0.2 = 0.32 < 0.5 => true
    expect(model.shouldEscalate('unknown', 0.2)).toBe(true);
    
    // High confidence but low domain rate
    for (let i = 0; i < 10; i++) model.updateFromEpisode('bad_domain', 'failure', 0.1);
    // rate = 0. combined = 0.6*0.8 + 0.4*0 = 0.48 < 0.5 => true
    expect(model.shouldEscalate('bad_domain', 0.8)).toBe(true);
  });

  it('regenerates narrative every 10 episodes', () => {
    const model = new AgentSelfModel();
    const writeFileSync = fs.writeFileSync as any;
    writeFileSync.mockClear();
    
    for (let i = 0; i < 10; i++) {
      model.updateFromEpisode('test', 'success', 1.0);
    }
    expect(writeFileSync).toHaveBeenCalled();
  });
});

describe('GlobalWorkspace', () => {
  it('is a singleton', () => {
    const ws1 = GlobalWorkspace.getInstance();
    const ws2 = GlobalWorkspace.getInstance();
    expect(ws1).toBe(ws2);
  });

  it('broadcasts updates to subscribers', () => {
    const ws = GlobalWorkspace.getInstance();
    const mockHandler = vi.fn();
    ws.subscribe('test_module', mockHandler);
    
    ws.broadcast({ currentIntent: 'test_intent' });
    expect(mockHandler).toHaveBeenCalledWith({ currentIntent: 'test_intent' });
    expect(ws.getContext().currentIntent).toBe('test_intent');
  });
});
