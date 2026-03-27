import { GoogleGenerativeAI } from '@google/generative-ai';
import { IntentPacket } from '../router/schema.js';
import { getSystemStatus, getSystemStatusDeclaration } from '../tools/system.js';
import { readFileLocal, writeFileLocal, readFileDeclaration, writeFileDeclaration } from '../tools/filesystem.js';
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
    tools: [{ functionDeclarations: [
      getSystemStatusDeclaration,
      readFileDeclaration,
      writeFileDeclaration
    ] }],
    systemInstruction: `You are Vadjanix, an uncompromising autonomous agent.
CONSTITUTION (CORE RULES):
${principles}

INSTRUCTIONS:
- You have access to local tools. Use them if the user asks for system information or to read/write files.
- You have secure read/write access to a local 'workspace' folder. Use this for creating code, saving notes, or reading local data.
- Maintain a professional and direct persona.
- If a tool fails, inform the user honestly.`
  });

  const chat = model.startChat({
    history: [],
    generationConfig: { temperature: 0 },
  });

  const prompt = `USER MESSAGE: "${message}"`;

  try {
    let result = await chat.sendMessage(prompt);
    let response = result.response;
    
    // Check for function calls
    let calls = response.functionCalls();
    while (calls && calls.length > 0) {
      const toolResponses = [];
      for (const call of calls) {
        console.log(`[BRAIN] Tool Execution: ${call.name}`, call.args);
        
        if (call.name === "get_system_status") {
          try {
            const systemData = await getSystemStatus();
            toolResponses.push({
              functionResponse: { name: "get_system_status", response: { content: systemData } }
            });
          } catch (e: any) {
            toolResponses.push({
              functionResponse: { name: "get_system_status", response: { error: e.message } }
            });
          }
        } else if (call.name === "read_file") {
          const { filename } = call.args as { filename: string };
          const content = await readFileLocal(filename);
          toolResponses.push({
            functionResponse: { name: "read_file", response: { content } }
          });
        } else if (call.name === "write_file") {
          const { filename, content } = call.args as { filename: string, content: string };
          const status = await writeFileLocal(filename, content);
          toolResponses.push({
            functionResponse: { name: "write_file", response: { status } }
          });
        }
      }

      if (toolResponses.length > 0) {
        // Send tool outputs back to Gemini
        const toolResult = await chat.sendMessage(toolResponses);
        response = toolResult.response;
        calls = response.functionCalls();
      } else {
        break;
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
