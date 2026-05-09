import assert from 'node:assert';
import { createAdapter } from '../src/core/adapter_factory.js';
import { OllamaAdapter } from '../src/adapters/ollama_adapter.js';

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
  console.log('--- STARTING ADAPTER FACTORY TESTS ---');

  await runTest('createAdapter({provider:"ollama"}) returns OllamaAdapter', () => {
    const adapter = createAdapter({ provider: 'ollama' });
    assert.ok(adapter instanceof OllamaAdapter);
  });

  await runTest('isAvailable() returns boolean and does not throw when Ollama is offline', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error('Connection refused'); };
    
    try {
      const adapter = new OllamaAdapter();
      const available = await adapter.isAvailable();
      
      assert.strictEqual(typeof available, 'boolean');
      assert.strictEqual(available, false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  console.log('ADAPTER STATUS: OPERATIONAL.\n');
}

main();
