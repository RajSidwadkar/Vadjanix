import { ILLMProvider, LLMResponse } from './ILLMProvider.js';
import { OllamaAdapter } from './OllamaAdapter.js';
import { GeminiAdapter } from './GeminiAdapter.js';

export class FallbackLLMProvider implements ILLMProvider {
  public name = 'semantic_router';

  private qwenCoder = new OllamaAdapter('qwen2.5-coder:1.5b');
  private qwenBase = new OllamaAdapter('qwen2.5:1.5b');
  private llama1b = new OllamaAdapter('llama3.2:1b');
  private llama8b = new OllamaAdapter('llama3:latest');
  private gemma3 = new OllamaAdapter('gemma3:4b');
  private gemini = new GeminiAdapter();

  constructor() {}

  private determineCascade(prompt: string): ILLMProvider[] {
    const normalized = prompt.toLowerCase().trim();
    const trivialRegex = /^(hi+|hello+|hey+|ping|test|yo|sup)$/i;
    const complexKeywords = ['code', 'explain', 'analyze', 'solve', 'bug'];

    if (trivialRegex.test(normalized)) {
      return [this.qwenCoder, this.gemini];
    }

    if (normalized.length > 300 || complexKeywords.some(key => normalized.includes(key))) {
      return [this.gemma3, this.llama8b, this.gemini];
    }

    return [this.qwenCoder, this.qwenBase, this.llama1b, this.gemma3, this.gemini];
  }

  public async reason(prompt: string, context?: any): Promise<LLMResponse> {
    const cascade = this.determineCascade(prompt);
    console.log(`[DECIDER] 🧠 Prompt classified. Generated cascade path: ${cascade.map(p => p.name).join(' -> ')}`);

    for (const provider of cascade) {
      console.log(`[ORCHESTRATOR] 🔄 Attempting to engage: ${provider.name}`);
      try {
        const result = await provider.reason(prompt, context);
        console.log(`[ORCHESTRATOR] ✅ Success utilizing: ${provider.name}`);
        return result;
      } catch (error: any) {
        console.warn(`[ORCHESTRATOR] ⚠️ ${provider.name} failed: ${error.message}. Cascading to next...`);
        continue;
      }
    }
    throw new Error("All LLM providers are offline.");
  }

  public async isAvailable(): Promise<boolean> {
    const providers = [this.qwenCoder, this.qwenBase, this.llama1b, this.gemma3, this.llama8b, this.gemini];
    for (const provider of providers) {
      if (await provider.isAvailable()) {
        return true;
      }
    }
    return false;
  }
}
