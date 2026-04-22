export interface LLMResponse {
  text: string;
  confidence: number;
}

export interface ILLMProvider {
  name: string;
  reason(prompt: string, context?: object): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
}
