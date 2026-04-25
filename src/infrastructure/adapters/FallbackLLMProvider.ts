import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class FallbackLLMProvider implements ILLMProvider {
  public name = 'fallback_router';

  constructor(private providers: ILLMProvider[]) {}

  public async reason(prompt: string, context?: any): Promise<LLMResponse> {
    for (const provider of this.providers) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        try {
          return await provider.reason(prompt, context);
        } catch (error: any) {
          console.warn(`\n[LLM ROUTER] Provider (${provider.name}) failed: ${error.message}. Cascading to next...\n`);
        }
      } else {
        console.warn(`\n[LLM ROUTER] Provider (${provider.name}) is offline. Cascading to next...\n`);
      }
    }
    throw new Error('All LLM providers failed.');
  }

  public async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        return true;
      }
    }
    return false;
  }
}
