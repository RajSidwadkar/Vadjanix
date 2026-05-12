import { describe, it, expect, vi } from 'vitest';
import { createAdapter } from '../src/infrastructure/adapters/AdapterFactory.js';
import { OllamaAdapter } from '../src/infrastructure/adapters/OllamaAdapter.js';
import { FallbackLLMProvider } from '../src/infrastructure/adapters/FallbackLLMProvider.js';

describe('Adapter Factory', () => {
  it('createAdapter({provider:"slm"}) returns FallbackLLMProvider (which contains Ollama)', async () => {
    const adapter = await createAdapter({ provider: 'slm' });
    expect(adapter).toBeInstanceOf(FallbackLLMProvider);
  });

  it('OllamaAdapter isAvailable() returns boolean', async () => {
    const adapter = new OllamaAdapter('gemma2:2b');
    const available = await adapter.isAvailable();
    expect(typeof available).toBe('boolean');
  });
});
