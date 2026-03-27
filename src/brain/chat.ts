import { GoogleGenerativeAI } from '@google/generative-ai';
import { IntentPacket } from '../router/schema.js';
import { getSystemStatus, getSystemStatusDeclaration } from '../tools/system.js';
import 'dotenv/config';

/**
 * Handles conversational packets with action: 'write'.
 * Responds conversationally as the Vadjanix agent based on principles.
 */
export async function handleChat(incomingPacket: IntentPacket, principles: string): Promise<IntentPacket> {
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

  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Initialize model with tools
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", // Using stable 2.5-flash for tool calling reliability
    tools: [{ functionDeclarations: [getSystemStatusDeclaration] }],
  });

  const chat = model.startChat({
    history: [],
    generationConfig: { temperature: 0 },
  });

  const prompt = `You are Vadjanix, an uncompromising autonomous agent.
CONSTITUTION (CORE RULES):
${principles}

INSTRUCTIONS:
- You have access to local tools. Use them if the user asks for system information.
- Maintain a professional and direct persona.
- If a tool fails, inform the user honestly.

USER MESSAGE: "${message}"`;

  try {
    let result = await chat.sendMessage(prompt);
    let response = result.response;
    
    // Check for function calls
    const calls = response.functionCalls();
    if (calls && calls.length > 0) {
      const call = calls[0];
      if (call.name === "get_system_status") {
        console.log("[BRAIN] Tool Execution: get_system_status");
        try {
          const systemData = await getSystemStatus();
          // Send tool output back to Gemini
          const toolResult = await chat.sendMessage([{
            functionResponse: {
              name: "get_system_status",
              response: { content: systemData }
            }
          }]);
          response = toolResult.response;
        } catch (toolError: any) {
          console.error("[BRAIN] Tool Failure:", toolError.message);
          const toolResult = await chat.sendMessage([{
            functionResponse: {
              name: "get_system_status",
              response: { error: `Execution failed: ${toolError.message}` }
            }
          }]);
          response = toolResult.response;
        }
      }
    }

    const responseText = response.text().trim();

    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: { message: responseText },
      reasoning: "Conversational response with potential tool execution."
    };
  } catch (error: any) {
    console.error("CHAT ERROR:", error);
    throw new Error(`CHAT_ERROR: ${error.message}`);
  }
}
