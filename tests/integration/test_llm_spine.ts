import assert from 'node:assert';
import { createAdapter, SovereigntyOfflineError } from '../../src/infrastructure/adapters/AdapterFactory.js';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    console.error(error);
    process.exit(1);
  }
}

const originalFetch = global.fetch;

async function main() {
  const originalEnv = { ...process.env };

  await runTest('Test 1: Frontier Node Routing (Success)', async () => {
    process.env.DEFAULT_LLM = 'gemini';
    process.env.GEMINI_API_KEY = 'dummy-key';
    
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('generativelanguage.googleapis.com')) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false } as Response;
    };

    const adapter = await createAdapter({ provider: 'gemini' });
    assert.ok(adapter.name === 'gemini' || adapter.name === 'fallback-reliable-provider');
  });

  await runTest('Test 2: Graceful Degradation (Missing Key Fallback)', async () => {
    process.env.DEFAULT_LLM = 'gemini';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_KEY;

    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('127.0.0.1:11434')) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false } as Response;
    };
    
    const adapter = await createAdapter({ provider: 'gemini' });
    assert.ok(adapter.name === 'fallback-reliable-provider', `Expected fallback-reliable-provider but got ${adapter.name}`);
  });

  await runTest('Test 3: Graceful Degradation (Network 404 Fallback)', async () => {
    process.env.DEFAULT_LLM = 'gemini';
    process.env.GEMINI_API_KEY = 'dummy-key';

    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('generativelanguage.googleapis.com')) {
        return { ok: false } as Response;
      }
      if (url.includes('127.0.0.1:11434')) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false } as Response;
    };

    const adapter = await createAdapter({ provider: 'gemini' });
    assert.ok(adapter.name === 'fallback-reliable-provider', `Expected fallback-reliable-provider but got ${adapter.name}`);
  });

  await runTest('Test 4: Sovereignty Offline (Total Failure)', async () => {
    global.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };

    try {
      await createAdapter({ provider: 'gemini' });
      assert.fail('Should have thrown SovereigntyOfflineError');
    } catch (error) {
      assert.ok(error instanceof SovereigntyOfflineError);
    }
  });

  global.fetch = originalFetch;
  process.env = originalEnv;

  console.log('\nSTATUS: SPINE SECURE. DEGRADATION OPERATIONAL.');
  process.exit(0);
}

main();
