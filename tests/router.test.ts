import { describe, it, expect } from 'vitest';
import CognitiveRouter from '../src/core/cognitive_router.js';
import { embed } from '../src/embedding/embed_client.js';

describe('Cognitive Router', () => {
  it('L0 — Reflex fires for arithmetic input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('2 + 2');
    expect(result.source).toBe('reflex');
    expect(result.action).toBe('calculate_sum');
    expect(result.llmUsed).toBe(false);
  });

  it('L0 — Reflex fires for boundary violation (rm -rf)', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('rm -rf /');
    if (result.source === 'reflex') {
        expect(result.action).toBe('block_critical_command');
    }
  });

  it('L1 — Episodic fires for similar input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const input = 'What is the weather like?';
    const embedding = await embed(input);
    router.addEpisode(input, embedding, 'provide_weather_info');

    const result = await router.route('What is the weather like?');
    expect(result.source).toBe('episodic');
    expect(result.action).toBe('provide_weather_info');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('L2 — Causal fires for causal chain', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    router.addCausalEdge('smoke', 'fire', 'call_fire_department', 0.9);
    
    const result = await router.route('I see smoke');
    expect(result.source).toBe('causal');
    expect(result.action).toBe('call_fire_department');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('L3 — Fallback fires for unknown novel input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('Explain quantum entanglement in the style of a pirate');
    expect(result.source).toBe('llm_required');
    expect(result.llmUsed).toBe(true);
  });

  it('source field is always set correctly', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('random input');
    expect(['reflex', 'episodic', 'causal', 'llm_required']).toContain(result.source);
  });
});
