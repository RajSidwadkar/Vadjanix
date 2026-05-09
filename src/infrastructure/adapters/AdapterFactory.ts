import { GeminiAdapter } from './GeminiAdapter.js';
import { OllamaAdapter } from './OllamaAdapter.js';
import { GemmaLocalAdapter } from './GemmaLocalAdapter.js';
import { ILLMProvider } from './ILLMProvider.js';
import { FallbackLLMProvider } from './FallbackLLMProvider.js';

export class SovereigntyOfflineError extends Error {
  constructor() {
    super('SOVEREIGNTY_OFFLINE: All LLM adapters failed heartbeats.');
    this.name = 'SovereigntyOfflineError';
  }
}

export async function createAdapter(config: { provider: string }): Promise<ILLMProvider> {
  const slm_model = process.env.SLM_MODEL || 'gemma2:2b';
  const llm_model = process.env.LLM_MODEL || 'llama3:8b';

  const slm = new OllamaAdapter(slm_model);
  const local_llm = new OllamaAdapter(llm_model);
  const cloud_llm = new GeminiAdapter();

  // The order of fallback: SLM -> Local LLM -> Gemini
  const providers = [slm, local_llm, cloud_llm];

  // If the user requested a specific provider, we still want to give them preference
  // but if it fails, we fall back to the reliable chain.
  if (config.provider === 'gemini') {
    // If specifically asking for Gemini, maybe try it first or keep it in the chain
    // User said preference to SLM first for reliability and performance.
  }

  const fallbackProvider = new FallbackLLMProvider(providers);

  if (await fallbackProvider.isAvailable()) {
    return fallbackProvider;
  }

  throw new SovereigntyOfflineError();
}
