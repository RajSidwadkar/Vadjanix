import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class GemmaLocalAdapter implements ILLMProvider {
  public name = 'gemma_local';
  private endpoint = 'http://127.0.0.1:11434/api/generate';

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    try {
      const payload: any = {
        model: 'gemma:2b',
        prompt: prompt,
        stream: false,
        options: context?.generationConfig || {}
      };

      if (context?.systemInstruction) {
        payload.system = context.systemInstruction;
      }

      console.log('[LLM - LOCAL] Transmitting prompt... waiting for CPU inference (This may take minutes on cold boot)...');
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Gemma Local Error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log('[LLM - LOCAL] Inference complete.');
      return {
        text: data.response,
        confidence: 0.88
      };
    } catch (error: any) {
      console.error('[LLM DIAGNOSTIC ERROR]', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch('http://127.0.0.1:11434', { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
