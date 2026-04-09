import { ILLMProvider, LLMResponse } from './ILLMProvider.js';
import 'dotenv/config';

export class GeminiAdapter implements ILLMProvider {
  public name = 'gemini';
  private model = 'gemini-3.1-flash-lite-preview';

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GEMINI_KEY");

    const url = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${apiKey}`;
    
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: context?.generationConfig || {}
    };

    if (context?.systemInstruction) {
      body.system_instruction = {
        parts: [{ text: context.systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(`Gemini Error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      text,
      confidence: 0.91
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (!apiKey) return false;

    try {
      const url = `https://generativelanguage.googleapis.com/v1/models/${this.model}?key=${apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
