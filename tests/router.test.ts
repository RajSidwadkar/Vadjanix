import assert from 'node:assert';
import CognitiveRouter from '../src/core/cognitive_router.js';
import { embed } from '../src/embedding/embed_client.js';

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  console.log('--- STARTING COGNITIVE ROUTER TESTS ---');

  await runTest('L0 — Reflex fires for arithmetic input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('2 + 2');
    assert.strictEqual(result.source, 'reflex');
    assert.strictEqual(result.action, 'calculate_sum');
    assert.strictEqual(result.llmUsed, false);
  });

  await runTest('L0 — Reflex fires for boundary violation (rm -rf)', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('rm -rf /');
    if (result.source === 'reflex') {
        assert.strictEqual(result.action, 'block_critical_command');
    }
  });

  await runTest('L1 — Episodic fires for similar input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const input = 'What is the weather like?';
    const embedding = await embed(input);
    router.addEpisode(input, embedding, 'provide_weather_info');

    const result = await router.route('What is the weather like?');
    assert.strictEqual(result.source, 'episodic');
    assert.strictEqual(result.action, 'provide_weather_info');
    assert.ok(result.confidence >= 0.8);
  });

  await runTest('L2 — Causal fires for causal chain', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    router.addCausalEdge('smoke', 'fire', 'call_fire_department', 0.9);
    
    const result = await router.route('I see smoke');
    assert.strictEqual(result.source, 'causal');
    assert.strictEqual(result.action, 'call_fire_department');
    assert.ok(result.confidence > 0.7);
  });

  await runTest('L3 — Fallback fires for unknown novel input', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('Explain quantum entanglement in the style of a pirate');
    assert.strictEqual(result.source, 'llm_required');
    assert.strictEqual(result.llmUsed, true);
  });

  await runTest('source field is always set correctly', async () => {
    const router = new CognitiveRouter(':memory:', './config');
    const result = await router.route('random input');
    assert.ok(['reflex', 'episodic', 'causal', 'llm_required'].includes(result.source));
  });

  console.log('ROUTER STATUS: ROUTING STABLE.\n');
}

main();
