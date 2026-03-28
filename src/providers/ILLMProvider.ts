export interface ToolCallRequest {
  name: string;
  args: any; // Using any instead of object to match the user instructions but also make it more flexible
}

export interface LLMResponse {
  text: string | null;
  toolCall: ToolCallRequest | null;
}

export interface ILLMProvider {
  /**
   * Initialize the LLM with a system instruction and tools.
   * @param systemInstruction The identity and core instructions for the LLM.
   * @param tools An array of function declarations.
   */
  initialize(systemInstruction: string, tools: any[], config?: any): void;

  /**
   * Send a prompt to the LLM.
   * @param prompt The user's input.
   * @param sessionId A unique ID for the conversation session.
   * @returns A promise that resolves to an LLMResponse.
   */
  sendMessage(prompt: string, sessionId: string): Promise<LLMResponse>;

  /**
   * Send tool execution results back to the LLM to continue the conversation.
   * @param functionResponse The result(s) from tool execution.
   * @param sessionId A unique ID for the conversation session.
   * @returns A promise that resolves to an LLMResponse.
   */
  sendToolResponse(functionResponse: any, sessionId: string): Promise<LLMResponse>;
}
