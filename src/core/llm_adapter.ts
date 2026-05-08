export interface LLMAdapter {
  name: string;
  reason(prompt: string, context?: object): Promise<{ text: string, confidence: number }>;
  isAvailable(): Promise<boolean>;
}
