import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import 'dotenv/config';

import { IntentPacketSchema, IntentPacket } from '../router/schema.js';
import { handleChat } from './chat.js';
import { executeTask } from './task_runner.js';
import { evaluateProposal } from './negotiator.js';
import { logDecision } from '../memory/audit.js';
import { withTimeout, aggregateResults, AggregationStrategy } from './aggregator.js';
import { logSwarmRun } from '../memory/swarm_logger.js';
import { createAdapter } from '../providers/AdapterFactory.js';

export type SwarmTask = { 
  goal: string; 
  subtasks: IntentPacket[]; 
  aggregator_strategy: AggregationStrategy; 
};

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

function runDeterministicPreCheck(userPrompt: string): any | null {
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

import { gateMemoryWrite } from '../memory/memory_write_gate.js';

export async function logInteraction(userPrompt: string, packet: z.infer<typeof IntentPacketSchema>, counterpartyId: string = "user_default") {
  const memoryDir = path.join(process.cwd(), 'memory');
  const contextLogPath = path.join(memoryDir, 'context_log.md');
  const timestamp = new Date().toISOString();
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

  const isAllowed = await gateMemoryWrite(logEntry, counterpartyId, 1.0);
  if (!isAllowed) return;

  try {
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.appendFile(contextLogPath, logEntry, 'utf-8');
  } catch (error) {
    console.error("Memory Write Failed:", error);
  }
}

const SYSTEM_PROMPT = `You are Vadjanix, an uncompromising autonomous agent. 
Evaluate requests against CONSTITUTION and RECENT MEMORY.
JSON Schema:
{
  "from": "vadjanix://brain",
  "to": "user",
  "action": "read" | "write" | "propose" | "query" | "call" | "refuse",
  "payload": { "message": "string", "details": { "strategy": "compromise" | "hold_firm" | "walk_away" } },
  "reasoning": "string"
}
Rules:
1. "refuse" if CONSTITUTION violated.
2. "reasoning" must cite CONSTITUTION rule.
3. Reply directly in "payload.message".`;

export async function generateIntent(userPrompt: string, soulOverride?: string, sessionId: string = "default-intent-session") {
  if (process.env.SIMULATION_MODE !== 'true') {
    const guardrailTrip = runDeterministicPreCheck(userPrompt);
    if (guardrailTrip) {
      const validatedPacket = IntentPacketSchema.parse(guardrailTrip);
      await logInteraction(userPrompt, validatedPacket);
      return validatedPacket;
    }
  }

  let soulContext = soulOverride || await loadSoulContext();
  const recentMemory = await loadRecentMemory();

  const geminiSchema: any = {
    type: "object",
    properties: {
      from: { type: "string" },
      to: { type: "string" },
      action: { type: "string", enum: ['read', 'write', 'propose', 'query', 'call', 'refuse'] },
      payload: {
        type: "object",
        properties: { 
          message: { type: "string" },
          details: {
            type: "object",
            properties: { strategy: { type: "string", enum: ['compromise', 'hold_firm', 'walk_away'] } },
            required: ["strategy"]
          }
        },
        required: ["message"]
      },
      reasoning: { type: "string" }
    },
    required: ["from", "to", "action", "payload", "reasoning"]
  };

  const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
  const contextMessage = `[CONSTITUTION]\n${soulContext}\n\n[MEMORY]\n${recentMemory}\n\n[USER REQUEST]\n${userPrompt}`;

  try {
    const response = await adapter.reason(contextMessage, {
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      }
    });
    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);
    const validatedPacket = IntentPacketSchema.parse(parsed);
    await logInteraction(userPrompt, validatedPacket).catch(console.error);
    return validatedPacket;
  } catch (error: any) {
    console.error("BRAIN ERROR:", error);
    throw new Error(`BRAIN_ERROR: ${error.message}`);
  }
}

import { secureFetch } from '../router/network_guard.js';
import { checkRateLimit, getLimitExceededResponse } from './rate_limiter.js';

export async function processIncomingPacket(packet: IntentPacket, sessionId: string = "default-session"): Promise<IntentPacket> {
  if (packet.action === 'call') {
    if (!checkRateLimit(sessionId)) {
      return getLimitExceededResponse(sessionId);
    }
  }

  const principles = await loadSoulContext();
  let outboundPacket: IntentPacket;

  console.log(`[BRAIN] Processing action: ${packet.action}`);

  switch (packet.action) {
    case 'propose': {
      const details = packet.payload.details;
      const strategy = (details as any)?.strategy || 'compromise';
      const amountMatch = packet.payload.message.match(/\$(\d+)/);
      const incomingOffer = amountMatch ? parseInt(amountMatch[1], 10) : 300;
      const SELLER_LIMIT = 250;
      const CONCESSION_STEP = 10;
      outboundPacket = await evaluateProposal(strategy as any, 'seller', SELLER_LIMIT, incomingOffer, CONCESSION_STEP);
      break;
    }
    case 'read':
    case 'write': {
      outboundPacket = await handleChat(packet, principles, sessionId);
      await logDecision(packet.action, `Message: "${packet.payload.message.substring(0, 30)}..."`, 'Conversational Protocol', 'Generated chat response.');
      break;
    }
    case 'call': {
      outboundPacket = await executeTask(packet);
      const task_name = (packet.payload.details as any)?.task_name;
      await logDecision('call', `Task: ${task_name}`, 'Registry Execution Pattern', outboundPacket.action === 'write' ? 'Task executed successfully.' : 'Task failed or unauthorized.');
      break;
    }
    default: {
      outboundPacket = {
        from: 'vadjanix://brain',
        to: packet.reply_to || packet.from,
        action: 'refuse',
        payload: { message: "Action not recognized or unsupported by Brain switchboard." },
        reasoning: `Unhandled action: ${packet.action}`
      };
      await logDecision('refuse', `Action: ${packet.action}`, 'Switchboard Guardrail', 'Refused due to unsupported action.');
    }
  }

  outboundPacket.to = packet.reply_to || packet.from;
  const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3000/';
  try {
    await secureFetch(ROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outboundPacket)
    });
  } catch (error: any) {
    console.error(`[BRAIN] Failed to reach Router: ${error.message}`);
  }
  return outboundPacket;
}

export async function executeSwarmTask(swarm: SwarmTask): Promise<IntentPacket> {
  const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3000/';
  const startTime = Date.now();
  const agentsTotal = swarm.subtasks.map(s => s.to);

  const results = await Promise.all(
    swarm.subtasks.map(async (packet) => {
      const dispatchPromise = (async () => {
        try {
          const response = await secureFetch(ROUTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packet)
          });
          return await response.json() as IntentPacket;
        } catch (error: any) {
          return {
            from: 'vadjanix://brain',
            to: packet.to,
            action: 'refuse',
            payload: { message: `Subtask dispatch failed: ${error.message}` },
            reasoning: 'Network Error during Swarm Fan-Out'
          } as IntentPacket;
        }
      })();
      return withTimeout(dispatchPromise, 10000);
    })
  );

  const finalPacket = await aggregateResults(results, swarm.aggregator_strategy);
  const latencyMs = Date.now() - startTime;
  const agentsSuccess: string[] = [];
  const agentsTimeout: string[] = [];

  results.forEach((res, index) => {
    const agentAddr = swarm.subtasks[index].to;
    if (res === null) agentsTimeout.push(agentAddr);
    else agentsSuccess.push(agentAddr);
  });

  await logSwarmRun(swarm.goal, swarm.aggregator_strategy, agentsTotal, agentsSuccess, agentsTimeout, finalPacket.payload.message, latencyMs);
  return finalPacket;
}
