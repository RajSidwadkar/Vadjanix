import { GoogleGenerativeAI } from '@google/generative-ai';
import { IntentPacket } from '../router/schema.js';
import 'dotenv/config';

/**
 * Handles conversational packets with action: 'write'.
 * Responds conversationally as the Vadjanix agent based on principles.
 * 
 * @param incomingPacket The packet received from the user or another agent.
 * @param principles The core principles and guidelines for the Vadjanix agent.
 * @returns A new IntentPacket with the conversational response.
 */
export async function handleChat(incomingPacket: IntentPacket, principles: string): Promise<IntentPacket> {
  const message = incomingPacket.payload.message;

  // Error Handling: If the incoming packet lacks a message
  if (!message || message.trim() === "") {
    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: {
        message: "Received an empty message. How can I help you?"
      },
      reasoning: "Received an empty message. How can I help you?"
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const prompt = `You are Vadjanix, an intent-driven autonomous agent.

CORE PRINCIPLES:
${principles}

INSTRUCTIONS:
- Respond conversationally as the Vadjanix agent.
- Do NOT attempt to negotiate or execute tasks.
- Maintain a helpful, professional, and consistent persona aligned with your principles.

USER MESSAGE:
"${message}"

Provide your response as a direct message.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: {
        message: responseText
      },
      reasoning: "Handled conversational packet as Vadjanix agent."
    };
  } catch (error: any) {
    console.error("CHAT ERROR:", error);
    throw new Error(`CHAT_ERROR: ${error.message}`);
  }
}
