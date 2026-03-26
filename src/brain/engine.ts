import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import 'dotenv/config';

import { IntentPacketSchema, IntentPacket } from '../router/schema.js';
import { handleChat } from './chat.js';
import { executeTask } from './task_runner.js';
import { evaluateProposal } from './negotiator.js';

/**
 * Loads the core principles/constitution from the soul directory.
 */
async function loadSoulContext(): Promise<string> {
  let soulContext = "";
  const soulPath = path.join(process.cwd(), 'soul');
  try {
    const files = await fs.readdir(soulPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(soulPath, file), 'utf-8');
        soulContext += `\n--- ${file} ---\n${content}\n`;
      }
    }
  } catch (error) {
    console.error("Failed to load soul context:", error);
  }
  return soulContext;
}

/**
 * 1.5 Deterministic Pre-Check Layer
 * Runs hardcoded regex checks to bypass LLM calls for clear violations.
 */
function runDeterministicPreCheck(userPrompt: string): any | null {
  // Rule 1: Minimum Rate Check ($250)
  const rateMatch = userPrompt.match(/\$(\d+)/);
  if (rateMatch) {
    const amount = parseInt(rateMatch[1], 10);
    if (amount < 250) {
      return {
        from: 'vadjanix://brain',
        to: 'user',
        action: 'refuse',
        payload: { message: 'I decline. My minimum engagement rate is $250.' },
        reasoning: 'Deterministic Guardrail: Minimum Rate Violation'
      };
    }
  }

  // Rule 2: Monday Prohibition
  if (/monday/i.test(userPrompt)) {
    return {
      from: 'vadjanix://brain',
      to: 'user',
      action: 'refuse',
      payload: { message: 'I do not schedule synchronous interactions on Mondays.' },
      reasoning: 'Deterministic Guardrail: Monday Prohibition'
    };
  }

  return null;
}

// 2. Memory Reader
export async function loadRecentMemory(): Promise<string> {
  const memoryPath = path.join(process.cwd(), 'memory', 'context_log.md');
  try {
    const data = await fs.readFile(memoryPath, 'utf-8');
    return data.slice(-2500); 
  } catch (error: any) {
    if (error.code === 'ENOENT') return "No prior interactions.";
    return "";
  }
}

// 3. Memory Writer
export async function logInteraction(userPrompt: string, packet: z.infer<typeof IntentPacketSchema>, counterpartyId: string = "user_default") {
  const memoryDir = path.join(process.cwd(), 'memory');
  const contextLogPath = path.join(memoryDir, 'context_log.md');
  const timestamp = new Date().toISOString();

  // Extract dollar amount from user prompt for state tracking
  const amountMatch = userPrompt.match(/\$(\d+(?:,\d+)*(?:\.\d+)?)/);
  const offerAmount = amountMatch ? amountMatch[0] : "N/A";

  const logEntry = `
## [${timestamp}] - Counterparty: ${counterpartyId}
- **State Transition:** ${packet.action.toUpperCase()}
- **Offer Detected:** ${offerAmount}
- **Reasoning:** ${packet.reasoning}
- **Them:** "${userPrompt}"
- **Vadjanix:** "${packet.payload.message}"
`;

  try {
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.appendFile(contextLogPath, logEntry, 'utf-8');
  } catch (error) {
    console.error("Memory Write Failed:", error);
  }
}


// 4. Gemini Engine with TypeScript Override
export async function generateIntent(userPrompt: string, soulOverride?: string) {
  // Intercept with deterministic guardrails (Skip if in simulation mode to allow custom logic)
  if (process.env.SIMULATION_MODE !== 'true') {
    const guardrailTrip = runDeterministicPreCheck(userPrompt);
    if (guardrailTrip) {
      const validatedPacket = IntentPacketSchema.parse(guardrailTrip);
      await logInteraction(userPrompt, validatedPacket);
      return validatedPacket;
    }
  }

  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in .env");

  let soulContext = soulOverride || await loadSoulContext();

  const recentMemory = await loadRecentMemory();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // FIX: Cast the schema as 'any' to bypass TypeScript's overly strict SDK interface checks
  const geminiSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
      from: { type: SchemaType.STRING },
      to: { type: SchemaType.STRING },
      action: { 
        type: SchemaType.STRING, 
        enum: ['read', 'write', 'propose', 'query', 'call', 'refuse'] 
      },
      payload: {
        type: SchemaType.OBJECT,
        properties: { 
          message: { type: SchemaType.STRING },
          details: {
            type: SchemaType.OBJECT,
            properties: {
              strategy: { 
                type: SchemaType.STRING, 
                enum: ['compromise', 'hold_firm', 'walk_away']
              }
            },
            required: ["strategy"]
          }
        },
        required: ["message"]
      },
      reasoning: { type: SchemaType.STRING }
    },
    required: ["from", "to", "action", "payload", "reasoning"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
    }
  });

  const prompt = `You are Vadjanix, an uncompromising autonomous agent.

CONSTITUTION (CORE RULES):
${soulContext}

RECENT MEMORY (CONTEXT):
${recentMemory}

USER REQUEST: 
"${userPrompt}"

SYSTEM INSTRUCTIONS FOR JSON MAPPING:
You must evaluate the USER REQUEST against your CONSTITUTION and map your decision to the exact JSON fields below:

1. HOW TO CHOOSE THE "action":
   - You MUST select "refuse" IF the user's request violates ANY rule in the CONSTITUTION (e.g., offering less than your minimum rate, or asking for a meeting on a restricted day like Monday or the Weekend).
   - You MUST select "write" IF the request is valid, safe, or just asks a general question.

2. HOW TO WRITE THE "payload.message":
   - This is YOUR direct reply to the user.
   - NEVER just echo the user's request back to them. 
   - If your action is "refuse", explicitly state the rule they broke in your response (e.g., "I decline. My minimum engagement rate is $250.").

3. HOW TO WRITE THE "reasoning":
   - Name the exact rule/file from the CONSTITUTION you are applying.

4. STATIC ROUTING FIELDS:
   - The "from" field MUST always be exactly: "vadjanix://brain"
   - The "to" field MUST always be exactly: "user"`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const parsed = JSON.parse(responseText);
    const validatedPacket = IntentPacketSchema.parse(parsed);

    await logInteraction(userPrompt, validatedPacket).catch(console.error);

    return validatedPacket;
  } catch (error: any) {
    console.error("GEMINI ENGINE ERROR:", error);
    throw new Error(`BRAIN_ERROR: ${error.message}`);
  }
}

/**
 * Switchboard for incoming packets. 
 * Routes to Negotiator, Chat, or Task Runner based on action.
 */
export async function processIncomingPacket(packet: IntentPacket): Promise<IntentPacket> {
  const principles = await loadSoulContext();
  let outboundPacket: IntentPacket;

  console.log(`[BRAIN] Processing action: ${packet.action}`);

  switch (packet.action) {
    case 'propose': {
      // Logic for Negotiator switchboard
      const details = packet.payload.details;
      const strategy = (details as any)?.strategy || 'compromise';
      
      // Attempt to extract the last offer from the message or payload
      const amountMatch = packet.payload.message.match(/\$(\d+)/);
      const incomingOffer = amountMatch ? parseInt(amountMatch[1], 10) : 300;
      
      // Default Negotiator Params (Seller Role)
      const SELLER_LIMIT = 250;
      const CONCESSION_STEP = 10;
      
      outboundPacket = evaluateProposal(
        strategy as any, 
        'seller', 
        SELLER_LIMIT, 
        incomingOffer, 
        CONCESSION_STEP
      );
      break;
    }

    case 'read':
    case 'write': {
      outboundPacket = await handleChat(packet, principles);
      break;
    }

    case 'call': {
      outboundPacket = await executeTask(packet);
      break;
    }

    default: {
      console.warn(`[BRAIN] Unhandled action: ${packet.action}`);
      outboundPacket = {
        from: 'vadjanix://brain',
        to: packet.reply_to || packet.from,
        action: 'refuse',
        payload: { message: "Action not recognized or unsupported by Brain switchboard." },
        reasoning: `Unhandled action: ${packet.action}`
      };
    }
  }

  // Ensure routing is correct (Reply to sender)
  outboundPacket.to = packet.reply_to || packet.from;

  // Outbound HTTP fetch call to the Router
  const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3000/';
  try {
    console.log(`[BRAIN] Sending response to Router: ${outboundPacket.action}`);
    await fetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outboundPacket)
    });
  } catch (error: any) {
    console.error(`[BRAIN] Failed to reach Router: ${error.message}`);
  }

  return outboundPacket;
}
