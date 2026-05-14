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
  const slm_model = process.env.SLM_MODEL || 'llama3.2:1b';
  const llm_model = process.env.LLM_MODEL || 'llama3:latest';

  const slm = new OllamaAdapter(slm_model);
  const local_llm = new OllamaAdapter(llm_model);
  const cloud_llm = new GeminiAdapter();

  // Additional opportunistic fallbacks based on common models
  const secondary_slm = new OllamaAdapter('gemma2:2b');
  const tertiary_slm = new OllamaAdapter('phi3');
  const fallback_llama = new OllamaAdapter('llama3:8b');

  // Determine priority based on config
  let providers: ILLMProvider[];
  if (config.provider === 'gemini') {
    providers = [cloud_llm, slm, local_llm, secondary_slm, fallback_llama];
  } else if (config.provider === 'local' || config.provider === 'llm') {
    providers = [local_llm, slm, cloud_llm, secondary_slm, fallback_llama];
  } else {
    // Default: SLM first
    providers = [slm, local_llm, secondary_slm, cloud_llm, fallback_llama, tertiary_slm];
  }

  const fallbackProvider = new FallbackLLMProvider(providers);

  if (await fallbackProvider.isAvailable()) {
    return fallbackProvider;
  }

  throw new SovereigntyOfflineError();
}
