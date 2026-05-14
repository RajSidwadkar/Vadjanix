import * as os from 'os';
import { ILLMProvider, LLMResponse } from './ILLMProvider.js';

export class OllamaAdapter implements ILLMProvider {
  public name: string;
  private endpoint = 'http://127.0.0.1:11434/api/generate';

  constructor(private modelName: string) {
    this.name = `ollama-${modelName}`;
  }

  async reason(prompt: string, context?: any): Promise<LLMResponse> {
    try {
      const systemRequirement = "You are a system router. You MUST return a JSON object strictly adhering to the provided schema. Do not invent new keys. You must ONLY output raw, valid JSON. Never output conversational text, markdown formatting, or explanations.";
      const payload: any = {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        keep_alive: -1,
        context: context?.kv_cache, // Inject previous KV cache tokens
        format: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            action: { type: "string", enum: ["read", "write", "propose", "query", "call", "refuse"] },
            payload: { type: "object" },
            reasoning: { type: "string" }
          },
          required: ["from", "to", "action", "payload", "reasoning"]
        },
        options: {
          ...(context?.generationConfig || {}),
          num_ctx: 2048,
          num_thread: Math.max(1, Math.floor(os.cpus().length / 2))
        }
      };

      if (context?.systemInstruction) {
        payload.system = `${context.systemInstruction}\n\n${systemRequirement}`;
      } else {
        payload.system = systemRequirement;
      }

      console.log(`[LLM - LOCAL] 🧠 Transmitting prompt to local engine: ${this.modelName}...`);
      
      const isHeavy = this.modelName.includes('gemma3') || this.modelName.includes('llama3:latest');
      const timeoutMs = isHeavy ? 30000 : 15000;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama Error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log(`[LLM - LOCAL] Raw response from ${this.modelName}: ${data.response?.substring(0, 100)}...`);
      return {
        text: data.response,
        confidence: 0.72,
        context: data.context
      };
    } catch (error: any) {
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      // First check if service is up
      const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) return false;
      
      const data = await response.json() as any;
      const models = data.models || [];
      
      // Check if the requested model exists
      // Ollama model names can be "model" or "model:tag"
      return models.some((m: any) => 
        m.name === this.modelName || 
        m.name === `${this.modelName}:latest` ||
        (this.modelName.includes(':') && m.name === this.modelName)
      );
    } catch (error) {
      return false;
    }
  }

  async warmup(): Promise<void> {
    console.log(`[LLM - OLLAMA] 🌡️ Warming up model: ${this.modelName}...`);
    try {
      // Sending a minimal prompt with keep_alive: -1 to load model into RAM
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt: "hi",
          stream: false,
          keep_alive: -1
        })
      });
      console.log(`[LLM - OLLAMA] 🔥 Model ${this.modelName} is now warm and active in RAM.`);
    } catch (error: any) {
      console.warn(`[LLM - OLLAMA] ⚠️ Warmup failed for ${this.modelName}:`, error.message);
    }
  }
}
