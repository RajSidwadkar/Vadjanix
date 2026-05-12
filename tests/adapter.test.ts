import { describe, it, expect } from 'vitest';
import { createAdapter } from '../src/core/adapter_factory.js';
import { OllamaAdapter } from '../src/adapters/ollama_adapter.js';

describe('Adapter Factory', () => {
  it('createAdapter({provider:"ollama"}) returns OllamaAdapter', () => {
    const adapter = createAdapter({ provider: 'ollama' });
    expect(adapter).toBeInstanceOf(OllamaAdapter);
  });

  it('isAvailable() returns boolean and does not throw when Ollama is offline', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error('Connection refused'); };
    
    try {
      const adapter = new OllamaAdapter();
      const available = await adapter.isAvailable();
      
      expect(typeof available).toBe('boolean');
      expect(available).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
