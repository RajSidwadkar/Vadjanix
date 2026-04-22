import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class FallbackLLMProvider implements ILLMProvider {
  public name = 'fallback_router';

  constructor(private primary: ILLMProvider, private secondary: ILLMProvider) {}

  public async reason(prompt: string, context?: any): Promise<LLMResponse> {
    const isPrimaryAvailable = await this.primary.isAvailable();
    if (isPrimaryAvailable) {
      try {
        return await this.primary.reason(prompt, context);
      } catch (error) {
        console.warn(`\n[LLM ROUTER] Primary (${this.primary.name}) failed or offline. Routing to Secondary (${this.secondary.name})...\n`);
        return await this.secondary.reason(prompt, context);
      }
    } else {
      console.warn(`\n[LLM ROUTER] Primary (${this.primary.name}) failed or offline. Routing to Secondary (${this.secondary.name})...\n`);
      return await this.secondary.reason(prompt, context);
    }
  }

  public async isAvailable(): Promise<boolean> {
    const primaryOk = await this.primary.isAvailable();
    const secondaryOk = await this.secondary.isAvailable();
    return primaryOk || secondaryOk;
  }
}
