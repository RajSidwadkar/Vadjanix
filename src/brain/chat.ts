import { IntentPacket } from '../router/schema.js';
import { getSystemStatus, getSystemStatusDeclaration } from '../tools/system.js';
import { readFileLocal, writeFileLocal, readFileDeclaration, writeFileDeclaration } from '../tools/filesystem.js';
import { GeminiAdapter } from '../providers/GeminiAdapter.js';
import 'dotenv/config';

// Persistent LLM instance for Chat
const chatLlm = new GeminiAdapter();
let isChatInitialized = false;

/**
 * Handles conversational packets with action: 'write'.
 * Responds conversationally as the Vadjanix agent based on principles.
 */
export async function handleChat(incomingPacket: IntentPacket, principles: string, sessionId?: string): Promise<IntentPacket> {
  const message = incomingPacket.payload.message;

  if (!message || message.trim() === "") {
    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: { message: "Received an empty message. How can I help you?" },
      reasoning: "Empty message guardrail"
    };
  }

  // Derive sessionId from incomingPacket.from if not provided
  // e.g. "telegram://123456" -> "telegram-123456"
  const finalSessionId = sessionId || incomingPacket.from.replace('://', '-');

  // Initialize model with tools only once
  if (!isChatInitialized) {
    console.log("[BRAIN] Initializing persistent Chat LLM...");
    chatLlm.initialize(
      `You are Vadjanix, an elite, autonomous business and engineering assistant. Your creator and boss is Raj.
      
      ENVIRONMENT & IDENTITY:
      You are communicating with Raj directly through Telegram. You act as his proxy negotiator, system administrator, and strategist. 
      
      FORMATTING STRICT RULES:
      1. NEVER use Markdown. Do not use asterisks (**) for bolding, italics, or lists. 
      2. Use plain, conversational text.
      3. Keep paragraphs extremely short (1-2 sentences).
      4. Use double line breaks between thoughts so it is highly readable on a mobile phone screen.
      
      BEHAVIOR:
      If Raj asks you to negotiate or draft a message for a client, do not explain what you are doing. Simply output the exact, persuasive message he should copy and paste to the client.`,
      [
        getSystemStatusDeclaration,
        readFileDeclaration,
        writeFileDeclaration
      ]
    );
    isChatInitialized = true;
  }

  const prompt = `USER MESSAGE: "${message}"`;

  try {
    let llmResponse = await chatLlm.sendMessage(prompt, finalSessionId);
    
    // Check for function calls
    while (llmResponse.toolCall) {
      const call = llmResponse.toolCall;
      console.log(`[BRAIN] Tool Execution: ${call.name}`, call.args);
      
      let toolResult: any;
      
      if (call.name === "get_system_status") {
        try {
          const systemData = await getSystemStatus();
          toolResult = { content: systemData };
        } catch (e: any) {
          toolResult = { error: e.message };
        }
      } else if (call.name === "read_file") {
        const { filename } = call.args as { filename: string };
        const content = await readFileLocal(filename);
        toolResult = { content };
      } else if (call.name === "write_file") {
        const { filename, content } = call.args as { filename: string, content: string };
        const status = await writeFileLocal(filename, content);
        toolResult = { status };
      }

      // Send tool output back to LLM
      const toolResponses = [{
        functionResponse: { name: call.name, response: toolResult }
      }];
      
      llmResponse = await chatLlm.sendToolResponse(toolResponses, finalSessionId);
    }

    const responseText = llmResponse.text || "I processed your request.";

    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: { message: responseText.trim() },
      reasoning: "Conversational response with potential tool execution."
    };
  } catch (error: any) {
    console.error("CHAT ERROR:", error);
    throw new Error(`CHAT_ERROR: ${error.message}`);
  }
}
