import { ILLMProvider, LLMResponse } from './ILLMProvider.js';
import 'dotenv/config';

export class GeminiAdapter implements ILLMProvider {
  public name = 'gemini';
  private model = 'gemini-1.5-flash';

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GEMINI_KEY");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;
    
    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };

    if (context?.systemInstruction) {
      payload.systemInstruction = {
        role: 'user',
        parts: [{ text: context.systemInstruction }]
      };
    }

    if (context?.generationConfig) {
      const { response_mime_type, responseMimeType, ...validConfig } = context.generationConfig;
      payload.generationConfig = validConfig;
      if (responseMimeType || response_mime_type) {
        payload.generationConfig.responseMimeType = responseMimeType || response_mime_type;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
