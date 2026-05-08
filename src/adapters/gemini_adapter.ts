import { LLMAdapter } from '../core/llm_adapter.js';
import { SecureVault } from '../security/vault.js';

export class GeminiAdapter implements LLMAdapter {
  public name = 'gemini';
  private model = 'gemini-1.5-flash';

  private getApiKey(): string {
    const vault = new SecureVault(process.env.MASTER_PASSWORD || 'default-password');
    return vault.get('GEMINI_KEY');
  }

  async reason(prompt: string, context?: object): Promise<{ text: string, confidence: number }> {
    const apiKey = this.getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...context
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini Error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      text,
      confidence: 0.91
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey();
      return !!apiKey;
    } catch {
      return false;
    }
  }
}
