import { LLMAdapter } from '../core/llm_adapter.js';
import fs from 'node:fs';

export class OllamaAdapter implements LLMAdapter {
  public name = 'ollama';
  private endpoint = 'http://localhost:11434/api/generate';
  private model: string;

  constructor() {
    try {
      if (fs.existsSync('config.json')) {
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        this.model = config.ollama_model || 'phi3';
      } else {
        this.model = 'phi3';
      }
    } catch {
      this.model = 'phi3';
    }
    this.name = `ollama-${this.model}`;
  }

  async reason(prompt: string, context?: object): Promise<{ text: string, confidence: number }> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          ...context
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return {
        text: data.response,
        confidence: 0.72
      };
    } catch (error: any) {
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434');
      return response.ok;
    } catch {
      return false;
    }
  }
}
