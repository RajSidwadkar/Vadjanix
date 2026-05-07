import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { embed, RouteResult, cosineSimilarity } from '../embedding/embed_client.js';

interface Boundary {
  id: string;
  trigger: string;
  action: string;
}

interface Principle {
  id: string;
  condition: string;
  action: string;
  confidence: number;
  success_rate: number;
}

export class CognitiveRouter {
  private db: Database.Database;
  private boundaries: Boundary[] = [];
  private principles: Principle[] = [];
  private contacts: any = {};
  private owner: any = {};
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
        entity TEXT,
        cause TEXT,
        effect TEXT,
        action TEXT
      );
    `);
  }

  public reloadConfigs() {
    try {
      this.boundaries = JSON.parse(fs.readFileSync(path.join(this.configPath, 'BOUNDARIES.json'), 'utf-8'));
      this.principles = JSON.parse(fs.readFileSync(path.join(this.configPath, 'PRINCIPLES.json'), 'utf-8'));
      this.contacts = JSON.parse(fs.readFileSync(path.join(this.configPath, 'CONTACTS.json'), 'utf-8'));
      this.owner = JSON.parse(fs.readFileSync(path.join(this.configPath, 'OWNER.json'), 'utf-8'));
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  }

  public async route(input: string): Promise<RouteResult> {
    // L0: Reflex Layer
    const reflexMatch = this.checkReflex(input);
    if (reflexMatch) {
      return {
        action: reflexMatch,
        source: 'reflex',
        confidence: 1.0,
        llmUsed: false
      };
    }

    // L1: Episodic Layer
    const episodicMatch = await this.checkEpisodic(input);
    if (episodicMatch) {
      return episodicMatch;
    }

    // L2: Causal Layer
    const causalMatch = this.checkCausal(input);
    if (causalMatch) {
      return causalMatch;
    }

    // L3: Fallback Layer (LLM Required)
    return {
      action: 'request_llm_inference',
      source: 'llm_required',
      confidence: 0,
      llmUsed: true,
      context: {
        input,
        boundaries: this.boundaries,
        principles: this.principles,
        owner: this.owner
      }
    };
  }

  private checkReflex(input: string): string | null {
    for (const boundary of this.boundaries) {
      const regex = new RegExp(boundary.trigger, 'i');
      if (regex.test(input)) {
        return boundary.action;
      }
    }
    // Simple math check (simulated)
    if (/^\d+ \+ \d+$/.test(input)) {
        return 'calculate_sum';
    }
    return null;
  }

  private async checkEpisodic(input: string): Promise<RouteResult | null> {
    const inputEmbedding = await embed(input);
    const episodes = this.db.prepare('SELECT input, embedding, action FROM episodes').all() as any[];

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
    // Simple keyword search in causal_edges for simulation
    const edges = this.db.prepare('SELECT entity, action FROM causal_edges').all() as any[];
    for (const edge of edges) {
      if (input.toLowerCase().includes(edge.entity.toLowerCase())) {
        return {
          action: edge.action,
          source: 'causal',
          confidence: 0.9,
          llmUsed: false
        };
      }
    }
    return null;
  }
  
  // Helper for tests to inject memory
  public addEpisode(input: string, embedding: number[], action: string) {
      const buffer = Buffer.from(new Float64Array(embedding).buffer);
      this.db.prepare('INSERT INTO episodes (input, embedding, action) VALUES (?, ?, ?)').run(input, buffer, action);
  }
  
  public addCausalEdge(entity: string, action: string) {
      this.db.prepare('INSERT INTO causal_edges (entity, action) VALUES (?, ?)').run(entity, action);
  }
}
