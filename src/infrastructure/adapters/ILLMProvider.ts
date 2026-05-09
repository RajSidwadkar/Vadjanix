export interface LLMResponse {
  text: string;
  confidence: number;
  context?: any;
}

export interface ILLMProvider {
  name: string;
  reason(prompt: string, context?: any): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
  warmup?(): Promise<void>;
}

