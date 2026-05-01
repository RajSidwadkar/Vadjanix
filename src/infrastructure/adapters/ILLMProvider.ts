export interface LLMResponse {
  text: string;
  confidence: number;
  context?: any;
}

export interface ILLMProvider {
  name: string;
  reason(prompt: string, context?: object): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
}
