import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class FallbackLLMProvider implements ILLMProvider {
  public name = 'fallback-reliable-provider';
  private providers: ILLMProvider[];

  constructor(providers: ILLMProvider[]) {
    this.providers = providers;
  }

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        console.log(`[LLM - FALLBACK] 🔄 Attempting with provider: ${provider.name}`);
        if (await provider.isAvailable()) {
          const response = await provider.reason(prompt, context);
          return response;
        } else {
          console.warn(`[LLM - FALLBACK] ⚠️ Provider ${provider.name} is not available.`);
        }
      } catch (error: any) {
        console.error(`[LLM - FALLBACK] ❌ Provider ${provider.name} failed:`, error.message);
        lastError = error;
      }
    }

    throw new Error(`[LLM - FATAL] All providers failed. Last error: ${lastError?.message}`);
  }

  async isAvailable(): Promise<boolean> {
    console.log(`[LLM - FALLBACK] 🔍 Checking availability for all providers...`);
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        console.log(`[LLM - FALLBACK]   - ${provider.name}: ${available ? '✅ AVAILABLE' : '❌ OFFLINE'}`);
        if (available) return true;
      } catch (error: any) {
        console.warn(`[LLM - FALLBACK]   - ${provider.name}: ❌ ERROR (${error.message})`);
      }
    }
    return false;
  }

  async warmup(): Promise<void> {
    console.log(`[LLM - FALLBACK] 🌡️ Starting parallel warmup for all local providers...`);
    const localProviders = this.providers.filter(p => p.name.includes('ollama') || p.name.includes('gemma'));
    
    // Warming up in parallel to save time
    await Promise.all(localProviders.map(p => p.warmup?.()));
    console.log(`[LLM - FALLBACK] 🔥 Warmup sequence complete.`);
  }
}
