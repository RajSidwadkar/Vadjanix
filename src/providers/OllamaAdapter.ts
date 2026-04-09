import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class OllamaAdapter implements ILLMProvider {
  public name = 'ollama';
  private endpoint = 'http://localhost:11434/api/generate';

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    const payload: any = {
      model: 'phi3',
      prompt: prompt,
      stream: false,
      options: context?.generationConfig || {}
    };

    if (context?.systemInstruction) {
      payload.system = context.systemInstruction;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      text: data.response,
      confidence: 0.72
    };
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await fetch('http://localhost:11434', { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
