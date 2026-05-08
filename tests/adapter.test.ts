import { describe, it, expect, vi } from 'vitest';
import { createAdapter } from '../src/core/adapter_factory.js';
import { OllamaAdapter } from '../src/adapters/ollama_adapter.js';

describe('Adapter Factory', () => {
  it('createAdapter({provider:"ollama"}) returns OllamaAdapter', () => {
    const adapter = createAdapter({ provider: 'ollama' });
    expect(adapter).toBeInstanceOf(OllamaAdapter);
  });

  it('isAvailable() returns boolean and does not throw when Ollama is offline', async () => {
    // Mock fetch to simulate offline state
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    
    const adapter = new OllamaAdapter();
    const available = await adapter.isAvailable();
    
    expect(typeof available).toBe('boolean');
    expect(available).toBe(false);
    
    vi.unstubAllGlobals();
  });
});
