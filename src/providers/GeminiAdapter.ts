import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';
import { ILLMProvider, LLMResponse, ToolCallRequest } from './ILLMProvider.js';
import 'dotenv/config';

export class GeminiAdapter implements ILLMProvider {
  private sessions: Map<string, ChatSession> = new Map();
  private model: GenerativeModel | null = null;
  private config: any = null;

  initialize(systemInstruction: string, tools: any[], config?: any): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in .env");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const modelConfig: any = {
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }]
      },
      tools: []
    };

    if (tools && tools.length > 0) {
      modelConfig.tools.push({ functionDeclarations: tools });
    }

    if (config) {
      modelConfig.generationConfig = config;
      this.config = config;
    } else {
      this.config = { temperature: 0 };
    }

    this.model = genAI.getGenerativeModel(modelConfig);
  }

  private getOrCreateSession(sessionId: string): ChatSession {
    if (!this.model) {
      throw new Error("GeminiAdapter not initialized. Call initialize() first.");
    }

    if (!this.sessions.has(sessionId)) {
      const session = this.model.startChat({
        history: [],
        generationConfig: this.config,
      });
      this.sessions.set(sessionId, session);
    }

    return this.sessions.get(sessionId)!;
  }

  async sendMessage(prompt: string, sessionId: string): Promise<LLMResponse> {
    const session = this.getOrCreateSession(sessionId);

    try {
      const result = await session.sendMessage([{ text: prompt }]);
      return this.mapResponse(result.response);
    } catch (error: any) {
      console.error("GeminiAdapter sendMessage error:", error);
      throw error;
    }
  }

  async sendToolResponse(functionResponse: any, sessionId: string): Promise<LLMResponse> {
    const session = this.getOrCreateSession(sessionId);

    try {
      const result = await session.sendMessage(functionResponse);
      return this.mapResponse(result.response);
    } catch (error: any) {
      console.error("GeminiAdapter sendToolResponse error:", error);
      throw error;
    }
  }

  private mapResponse(response: any): LLMResponse {
    let text: string | null = null;
    try {
      text = response.text();
      if (text) text = text.trim();
    } catch (e) {}
    
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
