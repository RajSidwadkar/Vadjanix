import { GeminiAdapter } from './GeminiAdapter.js';
import { OllamaAdapter } from './OllamaAdapter.js';
import { ILLMProvider } from './ILLMProvider.js';

export class SovereigntyOfflineError extends Error {
  constructor() {
    super('SOVEREIGNTY_OFFLINE: All LLM adapters failed heartbeats.');
    this.name = 'SovereigntyOfflineError';
  }
}

export async function createAdapter(config: { provider: string }): Promise<ILLMProvider> {
  const gemini = new GeminiAdapter();
  const ollama = new OllamaAdapter();

  if (config.provider === 'gemini') {
    if (process.env.GEMINI_KEY || process.env.GEMINI_API_KEY) {
      if (await gemini.isAvailable()) {
        return gemini;
      }
    }
  }

  if (await ollama.isAvailable()) {
    return ollama;
  }

  throw new SovereigntyOfflineError();
}
