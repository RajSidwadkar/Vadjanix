import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';
import { ILLMProvider, LLMResponse, ToolCallRequest } from './ILLMProvider.js';
import 'dotenv/config';

export class GeminiAdapter implements ILLMProvider {
  private chatSession: ChatSession | null = null;
  private model: GenerativeModel | null = null;

  initialize(systemInstruction: string, tools: any[], config?: any): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in .env");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const modelConfig: any = {
      model: "gemini-2.5-flash",
      systemInstruction,
    };

    if (tools && tools.length > 0) {
      modelConfig.tools = [{ functionDeclarations: tools }];
    }

    if (config) {
      modelConfig.generationConfig = config;
    }

    this.model = genAI.getGenerativeModel(modelConfig);

    this.chatSession = this.model.startChat({
      history: [],
      generationConfig: config || { temperature: 0 },
    });
  }

  async sendMessage(prompt: string): Promise<LLMResponse> {
    if (!this.chatSession) {
      throw new Error("GeminiAdapter not initialized. Call initialize() first.");
    }

    try {
      const result = await this.chatSession.sendMessage(prompt);
      return this.mapResponse(result.response);
    } catch (error: any) {
      console.error("GeminiAdapter sendMessage error:", error);
      throw error;
    }
  }

  async sendToolResponse(functionResponse: any): Promise<LLMResponse> {
    if (!this.chatSession) {
      throw new Error("GeminiAdapter not initialized. Call initialize() first.");
    }

    try {
      const result = await this.chatSession.sendMessage(functionResponse);
      return this.mapResponse(result.response);
    } catch (error: any) {
      console.error("GeminiAdapter sendToolResponse error:", error);
      throw error;
    }
  }

  private mapResponse(response: any): LLMResponse {
    let text: string | null = null;
    try {
      // Use result.response.text() which might throw if no text part exists
      text = response.text();
      if (text) text = text.trim();
    } catch (e) {
      // No text part, probably just function calls
    }
    
    const functionCalls = response.functionCalls();
    
    let toolCall: ToolCallRequest | null = null;
    if (functionCalls && functionCalls.length > 0) {
      toolCall = {
        name: functionCalls[0].name,
        args: functionCalls[0].args,
      };
    }

    return { text, toolCall };
  }
}
