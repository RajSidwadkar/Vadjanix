import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class HybridLLMProvider implements ILLMProvider {
  public name = 'hybrid-hardware-router';
  private static localInferenceLock = false;

  constructor(
    private slm: ILLMProvider,
    private gemini: ILLMProvider
  ) {}

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    // Determine if this is a classification task (L3 Intent Detection)
    // or a heavy reasoning/NLG task (L4)
    const isClassification = prompt.toLowerCase().includes('intent') || 
                             prompt.toLowerCase().includes('classify') ||
                             (context?.systemInstruction && context.systemInstruction.includes('JSON object'));

    if (isClassification) {
      // Concurrency Limit: Ensure only one local inference at a time
      if (HybridLLMProvider.localInferenceLock) {
        console.warn(`[LLM - HYBRID] ⚠️ Local SLM busy. Offloading classification to Gemini...`);
        return this.gemini.reason(prompt, context);
      }

      HybridLLMProvider.localInferenceLock = true;
      try {
        console.log(`[LLM - HYBRID] 🤖 Routing to Local SLM (${this.slm.name}) for classification...`);
        return await this.slm.reason(prompt, context);
      } finally {
        HybridLLMProvider.localInferenceLock = false;
      }
    } else {
      console.log(`[LLM - HYBRID] ☁️ Routing to Gemini for heavy reasoning/NLG...`);
      return this.gemini.reason(prompt, context);
    }
  }

  async isAvailable(): Promise<boolean> {
    return (await this.slm.isAvailable()) || (await this.gemini.isAvailable());
  }

  async warmup(): Promise<void> {
    await this.slm.warmup?.();
  }
}
