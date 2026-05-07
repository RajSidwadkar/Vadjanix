import { CognitiveRouter } from '../core/cognitive_router.js';
import { embed } from '../embedding/embed_client.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Running CognitiveRouter Tests ---');

  // Initialize with in-memory DB for testing
  const router = new CognitiveRouter(':memory:', './config');

  // Test L0: Reflex Layer (Boundary violation)
  console.log('Testing L0: Reflex Layer...');
  const reflexResult = await router.route('rm -rf /');
  assert.strictEqual(reflexResult.source, 'reflex');
  assert.strictEqual(reflexResult.action, 'block_critical_command');
  assert.strictEqual(reflexResult.llmUsed, false);
  console.log('✓ L0 passed');

  // Test L1: Episodic Layer (Memory match)
  console.log('Testing L1: Episodic Layer...');
  const testInput = 'hello world';
  const testEmbedding = await embed(testInput);
  router.addEpisode(testInput, testEmbedding, 'greet_user');
  
  const episodicResult = await router.route(testInput);
  assert.strictEqual(episodicResult.source, 'episodic');
  assert.strictEqual(episodicResult.action, 'greet_user');
  assert.strictEqual(episodicResult.llmUsed, false);
  console.log('✓ L1 passed');

  // Test L2: Causal Layer (Entity match)
  console.log('Testing L2: Causal Layer...');
  router.addCausalEdge('battery', 'check_power_status');
  const causalResult = await router.route('My battery is low');
  assert.strictEqual(causalResult.source, 'causal');
  assert.strictEqual(causalResult.action, 'check_power_status');
  console.log('✓ L2 passed');

  // Test L3: Fallback Layer (LLM required)
  console.log('Testing L3: Fallback Layer...');
  const fallbackResult = await router.route('What is the capital of France?');
  assert.strictEqual(fallbackResult.source, 'llm_required');
  assert.strictEqual(fallbackResult.llmUsed, true);
  assert.strictEqual(fallbackResult.action, 'request_llm_inference');
  console.log('✓ L3 passed');

  console.log('--- All Tests Passed ---');
}

runTests().catch(err => {
  console.error('Test Failed:');
  console.error(err);
  process.exit(1);
});
