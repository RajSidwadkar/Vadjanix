import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { RoutingResult } from '../router/schema.js';
import { createAdapter } from '../infrastructure/adapters/AdapterFactory.js';

export class Router {
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
    const content = await fs.readFile(path.join(process.cwd(), 'PRINCIPLES.json'), 'utf-8');
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

  public async processUserInput(input: string): Promise<RoutingResult> {
    const reflex = await this.checkReflexes(input);
    if (reflex) return reflex;
    const causal = await this.causalInference(input);
    if (causal) return causal;
    const episodic = await this.findEpisodicMatch(input);
    if (episodic) return episodic;
    const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
    const response = await adapter.reason(input, { systemInstruction: "You are Vadjanix. Be concise." });
    const embedding = new Float32Array(this.getMockEmbedding(input));
    this.db.prepare('INSERT INTO episodes (input, output, embedding) VALUES (?, ?, ?)').run(input, response.text, Buffer.from(embedding.buffer));
    return {
      action: "query",
      source: "llm_required",
      confidence: response.confidence,
      llmUsed: true,
      cognitiveTrace: { strategy: "LLM fallback", latencyEst: 500, memoryState: "new", source: "llm_required", confidence: response.confidence },
      packet: { from: "vadjanix://brain", to: "user", action: "query", payload: { message: response.text }, reasoning: "LLM fallback." }
    };
  }

  private async checkReflexes(input: string): Promise<RoutingResult | null> {
    const mathRegex = /^(\d+)\s*([\+\-\*\/])\s*(\d+)$/;
    const match = input.match(mathRegex);
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
        action: "query", source: "reflex", confidence: 1.0, llmUsed: false,
        cognitiveTrace: { strategy: "Math", latencyEst: 1, memoryState: "none", source: "reflex", confidence: 1.0 },
        packet: { from: "vadjanix://reflex", to: "user", action: "query", payload: { message: res.toString() }, reasoning: "Math reflex." }
      };
    }
    const principles = await this.loadPrinciples();
    for (const reflex of principles.reflexes) {
      if (new RegExp(`\\b${reflex.trigger}\\b`, 'i').test(input)) {
        return {
          action: reflex.action, source: "reflex", confidence: 1.0, llmUsed: false,
          cognitiveTrace: { strategy: "Principle", latencyEst: 5, memoryState: "read-only", source: "reflex", confidence: 1.0 },
          packet: { from: "vadjanix://reflex", to: "user", action: reflex.action as any, payload: { message: reflex.response }, reasoning: "Principle reflex." }
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
      if (sim > maxSim) { maxSim = sim; bestMatch = row; }
    }
    if (maxSim > 0.8) {
      return {
        action: "query", source: "episodic_replay", confidence: maxSim, llmUsed: false,
        cognitiveTrace: { strategy: "Episodic", latencyEst: 10, memoryState: "replay", source: "episodic_replay", confidence: maxSim },
        packet: { from: "vadjanix://episodic", to: "user", action: "query", payload: { message: bestMatch.output }, reasoning: "Episodic match." }
      };
    }
    return null;
  }

  private async causalInference(input: string): Promise<RoutingResult | null> {
    const rows = this.db.prepare("SELECT cause, effect, confidence FROM causal_edges").all();
    let bestEdge: any = null;
    for (const edge of rows as any[]) {
      if (new RegExp(`\\b${edge.cause}\\b`, 'i').test(input)) {
        if (!bestEdge || edge.confidence > bestEdge.confidence) bestEdge = edge;
      }
    }
    if (bestEdge && bestEdge.confidence >= 0.75) {
      return {
        action: "query", source: "causal", confidence: bestEdge.confidence, llmUsed: false,
        cognitiveTrace: { strategy: "Causal", latencyEst: 20, memoryState: "inference", source: "causal", confidence: bestEdge.confidence },
        packet: { from: "vadjanix://causal", to: "user", action: "query", payload: { message: bestEdge.effect }, reasoning: "Causal inference." }
      };
    }
    return null;
  }
}
