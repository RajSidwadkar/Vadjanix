import Database from 'better-sqlite3';
import { pipeline } from '@xenova/transformers';
import { createAdapter } from '../providers/AdapterFactory.js';
import {
  EpisodicRecord,
  SemanticRecord,
  ProceduralRecord,
  AssociativeRecord,
  CausalGraphRecord,
  EPISODIC_SCHEMA,
  SEMANTIC_SCHEMA,
  PROCEDURAL_SCHEMA,
  ASSOCIATIVE_SCHEMA,
  CAUSAL_GRAPH_SCHEMA
} from './schema.js';

export interface EpisodicResult extends EpisodicRecord {
  score: number;
}

export interface RetrievalResult {
  episodic: EpisodicResult[];
  semantic: SemanticRecord[];
  procedural: ProceduralRecord[];
}

export class VadjanixMemory {
  private db: Database.Database;
  private extractor: any = null;

  constructor(dbPath: string = 'memory/vadjanix.db') {
    this.db = new Database(dbPath);
    this.db.exec(EPISODIC_SCHEMA);
    this.db.exec(SEMANTIC_SCHEMA);
    this.db.exec(PROCEDURAL_SCHEMA);
    this.db.exec(ASSOCIATIVE_SCHEMA);
    this.db.exec(CAUSAL_GRAPH_SCHEMA);
  }

  public async init(): Promise<void> {
    if (!this.extractor) {
      try {
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch (error) {
        console.error(error);
        throw new Error('Failed to load Xenova pipeline');
      }
    }
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    await this.init();
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return output.data as Float32Array;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async writeEpisode(data: Omit<EpisodicRecord, 'id' | 'timestamp' | 'consolidated' | 'embedding'>): Promise<string> {
    const embeddingArray = await this.getEmbedding(data.raw_exchange);
    const embeddingBuffer = Buffer.from(embeddingArray.buffer, embeddingArray.byteOffset, embeddingArray.byteLength);

    const stmt = this.db.prepare(`
      INSERT INTO episodic (channel, counterparty_id, raw_exchange, agent_action, outcome, emotional_valence, importance, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.channel,
      data.counterparty_id,
      data.raw_exchange,
      data.agent_action,
      data.outcome,
      data.emotional_valence,
      data.importance,
      embeddingBuffer
    );

    this.maybeConsolidate().catch(() => {});
    return result.lastInsertRowid.toString();
  }

  public writeCausalEdge(cause: string, effect: string, probability: number, conditions: string, mechanism: string, evidence_episodes: string, verified: number = 0): void {
    const stmt = this.db.prepare(`
      INSERT INTO causal_graph (cause, effect, probability, conditions, mechanism, evidence_episodes, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(cause, effect, probability, conditions, mechanism, evidence_episodes, verified);
  }

  public async retrieve(query: string, topK: number = 5): Promise<RetrievalResult> {
    const queryEmbedding = await this.getEmbedding(query);
    const now = Date.now() / 1000;

    const allEpisodes = this.db.prepare('SELECT * FROM episodic ORDER BY timestamp DESC LIMIT 1000').all() as EpisodicRecord[];
    const scoredEpisodes: EpisodicResult[] = [];

    for (const ep of allEpisodes) {
      const epEmbedding = new Float32Array(ep.embedding.buffer, ep.embedding.byteOffset, ep.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT);
      const semantic_sim = this.cosineSimilarity(queryEmbedding, epEmbedding);
      const ts = new Date(ep.timestamp).getTime() / 1000;
      const recency_decay = 1 / (1 + 0.001 * (now - ts) / 3600);
      const score = 0.6 * semantic_sim + 0.25 * recency_decay + 0.15 * ep.importance;
      
      scoredEpisodes.push({ ...ep, score });
    }

    scoredEpisodes.sort((a, b) => b.score - a.score);
    const topEpisodes = scoredEpisodes.slice(0, topK);

    const topSemantic = this.db.prepare('SELECT * FROM semantic ORDER BY confidence DESC LIMIT ?').all(topK) as SemanticRecord[];
    const topProcedural = this.db.prepare('SELECT * FROM procedural ORDER BY success_rate DESC LIMIT ?').all(topK) as ProceduralRecord[];

    return {
      episodic: topEpisodes,
      semantic: topSemantic,
      procedural: topProcedural
    };
  }

  public async maybeConsolidate(): Promise<void> {
    await this._maybeConsolidate();
  }

  private async _maybeConsolidate(): Promise<void> {
    const unconsolidated = this.db.prepare('SELECT * FROM episodic WHERE consolidated = 0 ORDER BY timestamp ASC LIMIT 10').all() as EpisodicRecord[];
    if (unconsolidated.length < 10) return;
    await this._consolidate(unconsolidated);
  }

  private async _consolidate(episodes: EpisodicRecord[]): Promise<void> {
    try {
      const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
      const prompt = `Extract a single core factual claim from the following interactions. Return only a valid JSON object with the exact keys: 'claim' (string), 'confidence' (number between 0 and 1), and 'domain' (string).\n\nInteractions:\n` + episodes.map(e => e.raw_exchange).join('\n');
      
      const response = await adapter.reason(prompt, {
        systemInstruction: "You are an AI memory consolidation engine. Extract facts as JSON without any markdown formatting.",
        generationConfig: { responseMimeType: "application/json" }
      });

      const parsedText = response.text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      const parsed = JSON.parse(parsedText);
      const distilled_from = episodes.map(e => e.id).join(',');

      await this._upsertSemanticFact(parsed.claim || 'Unknown', parsed.confidence || 0.5, parsed.domain || 'general', distilled_from);

      const ids = episodes.map(e => e.id);
      this.db.prepare(`UPDATE episodic SET consolidated = 1 WHERE id IN (${ids.join(',')})`).run();
    } catch (error) {
      
    }
  }

  private async _upsertSemanticFact(claim: string, confidence: number, domain: string, distilled_from: string): Promise<void> {
    const embeddingArray = await this.getEmbedding(claim);
    const embeddingBuffer = Buffer.from(embeddingArray.buffer, embeddingArray.byteOffset, embeddingArray.byteLength);
    
    this.db.prepare(`
      INSERT INTO semantic (claim, confidence, domain, distilled_from, embedding)
      VALUES (?, ?, ?, ?, ?)
    `).run(claim, confidence, domain, distilled_from, embeddingBuffer);
  }
}
