import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { IntentPacket, RoutingResult } from '../router/schema.js';
import { createAdapter } from '../providers/AdapterFactory.js';

export class CognitiveRouter {
  private db: Database.Database;

  constructor(dbPath: string = 'memory/vadjanix.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input TEXT,
        output TEXT,
        embedding BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS causal_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cause TEXT,
        effect TEXT,
        confidence REAL,
        metadata TEXT
      );
    `);
  }

  private async loadPrinciples() {
    const principlesPath = path.join(process.cwd(), 'soul/PRINCIPLES.json');
    const content = await fs.readFile(principlesPath, 'utf-8');
    return JSON.parse(content);
  }

  private dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private getMockEmbedding(text: string): number[] {
    const embedding = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      embedding[i % 128] += text.charCodeAt(i) / 255;
    }
    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return embedding.map(v => v / (mag || 1));
  }

  private async checkReflexes(input: string): Promise<RoutingResult | null> {
    const lowerInput = input.toLowerCase().trim();

    const mathRegex = /^(\d+)\s*([\+\-\*\/])\s*(\d+)$/;
    const match = lowerInput.match(mathRegex);
    if (match) {
      const a = parseInt(match[1]);
      const op = match[2];
      const b = parseInt(match[3]);
      let res = 0;
      if (op === '+') res = a + b;
      if (op === '-') res = a - b;
      if (op === '*') res = a * b;
      if (op === '/') res = a / b;

      return {
        action: "query",
        source: "reflex",
        confidence: 1.0,
        llmUsed: false,
        cognitiveTrace: {
          strategy: "Math Reflex: Evaluated arithmetic expression",
          latencyEst: 1,
          memoryState: "read-only",
          source: "reflex",
          confidence: 1.0
        },
        packet: {
          from: "vadjanix://reflex",
          to: "user",
          action: "query",
          payload: { message: res.toString() },
          reasoning: "Direct arithmetic reflex."
        }
      };
    }

    const principles = await this.loadPrinciples();
    for (const reflex of principles.reflexes) {
      const trigger = reflex.trigger.toLowerCase();
      const regex = new RegExp(`\\b${trigger}\\b`, 'i');
      if (regex.test(lowerInput)) {
        return {
          action: reflex.action,
          source: "reflex",
          confidence: 1.0,
          llmUsed: false,
          cognitiveTrace: {
            strategy: `Matched reflex: ${reflex.trigger}`,
            latencyEst: 5,
            memoryState: "read-only",
            source: "reflex",
            confidence: 1.0
          },
          packet: {
            from: "vadjanix://reflex",
            to: "user",
            action: reflex.action as any,
            payload: {
              message: reflex.response,
              details: reflex.task_name ? { task_name: reflex.task_name } : undefined
            },
            reasoning: "Direct reflex match from PRINCIPLES.json"
          }
        };
      }
    }
    return null;
  }

  private async findEpisodicMatch(input: string): Promise<RoutingResult | null> {
    const inputEmbedding = this.getMockEmbedding(input);
    const rows = this.db.prepare('SELECT input, output, embedding FROM episodes').all();
    
    let bestMatch: any = null;
    let maxSim = 0;

    for (const row of rows as any[]) {
      const rowEmbedding = Array.from(new Float32Array(row.embedding.buffer));
      const sim = this.dotProduct(inputEmbedding, rowEmbedding);
      if (sim > maxSim) {
        maxSim = sim;
        bestMatch = row;
      }
    }

    if (maxSim > 0.8) {
      return {
        action: "query",
        source: "episodic_replay",
        confidence: maxSim,
        llmUsed: false,
        cognitiveTrace: {
          strategy: `High-confidence episodic match (${maxSim.toFixed(2)})`,
          latencyEst: 15,
          memoryState: "replay_accessed",
          source: "episodic_replay",
          confidence: maxSim
        },
        packet: {
          from: "vadjanix://episodic",
          to: "user",
          action: "query",
          payload: {
            message: bestMatch.output,
            details: { parameters: { original_query: bestMatch.input } }
          },
          reasoning: `Episodic similarity match: ${maxSim.toFixed(2)}`
        }
      };
    }
    return null;
  }

  private async causalInference(input: string): Promise<RoutingResult | null> {
    const rows = this.db.prepare("SELECT cause, effect, confidence FROM causal_edges").all();
    
    let bestEdge: any = null;
    const lowerInput = input.toLowerCase();

    for (const edge of rows as any[]) {
      const regex = new RegExp(`\\b${edge.cause}\\b`, 'i');
      if (regex.test(lowerInput)) {
        if (!bestEdge || edge.confidence > bestEdge.confidence) {
          bestEdge = edge;
        }
      }
    }
    
    if (bestEdge && bestEdge.confidence >= 0.75) {
        return {
          action: "query",
          source: "causal",
          confidence: bestEdge.confidence,
          llmUsed: false,
          cognitiveTrace: {
            strategy: `Causal edge detected: ${bestEdge.cause} -> ${bestEdge.effect}`,
            latencyEst: 25,
            memoryState: "inference_active",
            source: "causal",
            confidence: bestEdge.confidence
          },
          packet: {
            from: "vadjanix://causal",
            to: "user",
            action: "query",
            payload: {
              message: `Inferring effect based on known cause: ${bestEdge.effect}`,
              details: { parameters: { cause: bestEdge.cause } }
            },
            reasoning: `Known causal relationship identified with ${bestEdge.confidence} confidence.`
          }
        };
      }
    
    return null;
  }

  public async processUserInput(input: string, sessionId: string = "default"): Promise<RoutingResult> {
    const startTime = Date.now();

    const reflexResult = await this.checkReflexes(input);
    if (reflexResult) return reflexResult;

    const causalResult = await this.causalInference(input);
    if (causalResult) return causalResult;

    const episodicResult = await this.findEpisodicMatch(input);
    if (episodicResult) return episodicResult;

    console.log("[ROUTER] Layers 1-3 confidence < 0.75. Triggering Sovereign LLM Fallback.");
    
    const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
    const response = await adapter.reason(input, {
      systemInstruction: "You are Vadjanix, a Sovereign AGI. Be concise."
    });

    const embedding = new Float32Array(this.getMockEmbedding(input));
    this.db.prepare('INSERT INTO episodes (input, output, embedding) VALUES (?, ?, ?)').run(
      input, response.text || "No response", Buffer.from(embedding.buffer)
    );

    return {
      action: "query",
      source: "llm_required",
      confidence: response.confidence,
      llmUsed: true,
      cognitiveTrace: {
        strategy: `LLM fallback triggered via ${adapter.name}`,
        latencyEst: Date.now() - startTime,
        memoryState: "new_episode_pending",
        source: "llm_required",
        confidence: response.confidence
      },
      packet: {
        from: "vadjanix://brain",
        to: "user",
        action: "query",
        payload: { message: response.text || "I'm processing that." },
        reasoning: "Synthesized via Sovereign LLM fallback."
      }
    };
  }
}
