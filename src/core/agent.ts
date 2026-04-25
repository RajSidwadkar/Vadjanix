import fs from 'fs/promises';
import path from 'path';
import { VadjanixMemory } from '../modules/memory/system.js';
import { ILLMProvider } from '../infrastructure/adapters/ILLMProvider.js';
import { IntentPacket, IntentPacketSchema } from '../router/schema.js';
import { MemoryWriteGate } from '../modules/security/memory_write_gate.js';

export class VadjanixAgent {
  constructor(
    private memory: VadjanixMemory,
    private llm: ILLMProvider
  ) {}

  public async handleIncomingMessage(platform: string, userId: string, message: string): Promise<string> {
    console.log(`\n[BRAIN - INCOMING] Platform: ${platform} | User: ${userId}`);
    console.log(`[BRAIN - INPUT] Text: "${message}"`);
    
    try {
      const sessionId = `${platform}-${userId}`;
      const packet = await this.handleRequest(message, sessionId);
      const response = packet.payload.message;
      
      console.log(`[BRAIN - OUTPUT] Generated: "${response}"\n`);
      return response;
    } catch (error: any) {
      console.error(`[BRAIN - FATAL ERROR] ${error.message || error}`);
      return "System Error: Brain offline.";
    }
  }

  public async handleRequest(prompt: string, sessionId: string = "default"): Promise<IntentPacket> {
    const guardrail = this.runDeterministicPreCheck(prompt);
    if (guardrail) {
      console.log(`[BRAIN - GUARDRAIL] Triggered: ${guardrail.reasoning}`);
      return guardrail;
    }

    const soulContext = await this.loadSoulContext();
    const retrieval = await this.memory.retrieve(prompt);
    const memoryContext = JSON.stringify(retrieval);

    const systemPrompt = `You are Vadjanix, an uncompromising autonomous agent.
Evaluate requests against CONSTITUTION and RECENT MEMORY.
Rules:
1. "refuse" if CONSTITUTION violated.
2. Reply directly in "payload.message".`;

    const context = `[CONSTITUTION]\n${soulContext}\n\n[MEMORY]\n${memoryContext}\n\n[USER REQUEST]\n${prompt}`;
    
    console.log(`[BRAIN - ROUTING] Requesting LLM reasoning...`);
    const response = await this.llm.reason(context, {
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0, responseMimeType: "application/json" }
    });

    try {
      const parsed = JSON.parse(response.text);
      const packet = IntentPacketSchema.parse(parsed);
      await this.logInteraction(prompt, packet);
      return packet;
    } catch (parseError: any) {
      console.error(`[BRAIN - PARSE ERROR] Failed to parse LLM response: ${response.text}`);
      throw new Error(`LLM output parse failure: ${parseError.message}`);
    }
  }

  private runDeterministicPreCheck(prompt: string): IntentPacket | null {
    if (prompt.match(/\$(\d+)/)) {
      const amount = parseInt(prompt.match(/\$(\d+)/)![1], 10);
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
    if (/monday/i.test(prompt)) {
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

  private async loadSoulContext(): Promise<string> {
    const principles = await fs.readFile(path.join(process.cwd(), 'PRINCIPLES.md'), 'utf-8');
    return principles;
  }

  private async logInteraction(prompt: string, packet: IntentPacket) {
    const logEntry = `[${new Date().toISOString()}] User: ${prompt} | Vadjanix: ${packet.payload.message}`;
    const isAllowed = await MemoryWriteGate.gateMemoryWrite(logEntry, "user", 1.0);
    if (isAllowed) {
      console.log(`[BRAIN - MEMORY] Writing episode to store...`);
      await this.memory.writeEpisode({
        channel: 'direct',
        counterparty_id: 'user',
        raw_exchange: prompt,
        agent_action: packet.action,
        outcome: packet.payload.message,
        emotional_valence: 0.5,
        importance: 0.5
      });
    } else {
      console.warn(`[BRAIN - MEMORY] Write blocked by Gate.`);
    }
  }
}
