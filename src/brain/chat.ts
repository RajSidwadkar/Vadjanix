import { IntentPacket } from '../router/schema.js';
import { createAdapter } from '../providers/AdapterFactory.js';
import 'dotenv/config';

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

  const systemInstruction = `You are Vadjanix, an elite, autonomous business and engineering assistant. Your creator and boss is Raj.
      
      ENVIRONMENT & IDENTITY:
      You are communicating with Raj directly through Telegram. You act as his proxy negotiator, system administrator, and strategist. 
      
      FORMATTING STRICT RULES:
      1. NEVER use Markdown. Do not use asterisks (**) for bolding, italics, or lists. 
      2. Use plain, conversational text.
      3. Keep paragraphs extremely short (1-2 sentences).
      4. Use double line breaks between thoughts so it is highly readable on a mobile phone screen.
      
      BEHAVIOR:
      If Raj asks you to negotiate or draft a message for a client, do not explain what you are doing. Simply output the exact, persuasive message he should copy and paste to the client.
      
      CONTEXT:
      ${principles}`;

  const prompt = `USER MESSAGE: "${message}"`;

  try {
    const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
    const response = await adapter.reason(prompt, { systemInstruction });
    
    return {
      from: "vadjanix://brain",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: { message: response.text.trim() },
      reasoning: "Conversational response via Sovereign LLM spine."
    };
  } catch (error: any) {
    console.error("CHAT ERROR:", error);
    throw new Error(`CHAT_ERROR: ${error.message}`);
  }
}
