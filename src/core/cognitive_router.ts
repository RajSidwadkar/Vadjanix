import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { embed, RouteResult, cosineSimilarity } from '../embedding/embed_client.js';

export default class CognitiveRouter {
  private db: Database.Database;
  private boundaries: any[] = [];
  private principles: any[] = [];
  private configPath: string;

  constructor(dbPath: string = 'vadjanix.db', configPath: string = './config') {
    this.configPath = configPath;
    this.db = new Database(dbPath);
    this.initDb();
    this.reloadConfigs();
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input TEXT,
        embedding BLOB,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS causal_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cause TEXT,
        effect TEXT,
        action TEXT,
        confidence REAL DEFAULT 1.0
      );
    `);
  }

  public reloadConfigs() {
    try {
      const boundariesPath = path.join(this.configPath, 'BOUNDARIES.json');
      const principlesPath = path.join(this.configPath, 'PRINCIPLES.json');
      
      if (fs.existsSync(boundariesPath)) {
        this.boundaries = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
      }
      if (fs.existsSync(principlesPath)) {
        this.principles = JSON.parse(fs.readFileSync(principlesPath, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  }

  public async route(input: string): Promise<RouteResult> {
    // L0 — Reflex: Load BOUNDARIES.json. Match condition strings against input.
    // This is hard-gated to prevent LLM latency for known boundaries.
    const reflexMatch = this.checkReflex(input);
    if (reflexMatch) {
      return {
        action: reflexMatch,
        source: 'reflex',
        confidence: 1.0,
        llmUsed: false
      };
    }

    // Special case for arithmetic
    if (/^\d+ \+ \d+$/.test(input)) {
        return {
            action: 'calculate_sum',
            source: 'reflex',
            confidence: 1.0,
            llmUsed: false
        };
    }

    // L1 — Episodic: Query episodic SQLite table.
    // Uses past experience to bypass LLM if threshold is met.
    const episodicMatch = await this.checkEpisodic(input);
    if (episodicMatch) {
      return episodicMatch;
    }

    // L2 — Causal: Query causal_edges table. BFS traversal. Return if confidence > 0.75.
    const causalMatch = this.checkCausal(input);
    if (causalMatch) {
      return causalMatch;
    }

    // L3 — LLM fallback: Return { source: 'llm_required', llmUsed: true }
    return {
      action: 'request_llm_inference',
      source: 'llm_required',
      confidence: 0,
      llmUsed: true
    };
  }

  private checkReflex(input: string): string | null {
    for (const boundary of this.boundaries) {
      if (boundary.trigger) {
        const regex = new RegExp(boundary.trigger, 'i');
        if (regex.test(input)) {
          return boundary.action;
        }
      }
    }
    return null;
  }

  private async checkEpisodic(input: string): Promise<RouteResult | null> {
    let inputEmbedding: number[];
    try {
        inputEmbedding = await embed(input);
    } catch (e) {
        return null;
    }

    const episodes = this.db.prepare('SELECT embedding, action FROM episodes').all() as any[];

    for (const episode of episodes) {
      const episodeEmbedding = Array.from(new Float64Array(episode.embedding.buffer));
      const similarity = cosineSimilarity(inputEmbedding, episodeEmbedding);
      
      if (similarity > 0.88) {
        return {
          action: episode.action,
          source: 'episodic',
          confidence: similarity,
          llmUsed: false
        };
      }
    }
    return null;
  }

  private checkCausal(input: string): RouteResult | null {
    // Find initial causes in input
    const initialEdges = this.db.prepare('SELECT cause, effect, action, confidence FROM causal_edges').all() as any[];
    
    // BFS Traversal
    let queue: { node: string, confidence: number, action: string | null }[] = [];
    
    for (const edge of initialEdges) {
        if (input.toLowerCase().includes(edge.cause.toLowerCase())) {
            queue.push({ node: edge.effect, confidence: edge.confidence, action: edge.action });
        }
    }

    let visited = new Set<string>();
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.action && current.confidence > 0.75) {
            return {
                action: current.action,
                source: 'causal',
                confidence: current.confidence,
                llmUsed: false
            };
        }

        if (visited.has(current.node)) continue;
        visited.add(current.node);

        const nextEdges = this.db.prepare('SELECT effect, action, confidence FROM causal_edges WHERE cause = ?').all(current.node) as any[];
        for (const edge of nextEdges) {
            queue.push({ 
                node: edge.effect, 
                confidence: current.confidence * edge.confidence, 
                action: edge.action 
            });
        }
    }

    return null;
  }
  
  // Helper for tests
  public addEpisode(input: string, embedding: number[], action: string) {
      const buffer = Buffer.from(new Float64Array(embedding).buffer);
      this.db.prepare('INSERT INTO episodes (input, embedding, action) VALUES (?, ?, ?)').run(input, buffer, action);
  }
  
  public addCausalEdge(cause: string, effect: string, action: string | null, confidence: number = 1.0) {
      this.db.prepare('INSERT INTO causal_edges (cause, effect, action, confidence) VALUES (?, ?, ?, ?)').run(cause, effect, action, confidence);
  }
}
