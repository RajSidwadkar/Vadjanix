import Database from 'better-sqlite3';
import {
  EpisodicRecord,
  SemanticRecord,
  ProceduralRecord,
  EPISODIC_SCHEMA,
  SEMANTIC_SCHEMA,
  PROCEDURAL_SCHEMA,
  ASSOCIATIVE_SCHEMA,
  CAUSAL_GRAPH_SCHEMA
} from './schema.js';

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string = 'memory/vadjanix.db') {
    this.db = new Database(dbPath);
    this.db.exec(EPISODIC_SCHEMA);
    this.db.exec(SEMANTIC_SCHEMA);
    this.db.exec(PROCEDURAL_SCHEMA);
    this.db.exec(ASSOCIATIVE_SCHEMA);
    this.db.exec(CAUSAL_GRAPH_SCHEMA);
  }

  public insertEpisodic(data: any): string | number {
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
      data.embedding
    );
    return result.lastInsertRowid.toString();
  }

  public insertCausal(data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO causal_graph (cause, effect, probability, conditions, mechanism, evidence_episodes, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(data.cause, data.effect, data.probability, data.conditions, data.mechanism, data.evidence_episodes, data.verified);
  }

  public getAllEpisodes(limit: number = 1000): EpisodicRecord[] {
    return this.db.prepare('SELECT * FROM episodic ORDER BY timestamp DESC LIMIT ?').all(limit) as EpisodicRecord[];
  }

  public getSemanticRecords(limit: number = 5): SemanticRecord[] {
    return this.db.prepare('SELECT * FROM semantic ORDER BY confidence DESC LIMIT ?').all(limit) as SemanticRecord[];
  }

  public getProceduralRecords(limit: number = 5): ProceduralRecord[] {
    return this.db.prepare('SELECT * FROM procedural ORDER BY success_rate DESC LIMIT ?').all(limit) as ProceduralRecord[];
  }

  public getUnconsolidatedEpisodes(limit: number = 10): EpisodicRecord[] {
    return this.db.prepare('SELECT * FROM episodic WHERE consolidated = 0 ORDER BY timestamp ASC LIMIT ?').all(limit) as EpisodicRecord[];
  }

  public markAsConsolidated(ids: number[]): void {
    this.db.prepare(`UPDATE episodic SET consolidated = 1 WHERE id IN (${ids.join(',')})`).run();
  }

  public insertSemantic(data: any): void {
    this.db.prepare(`
      INSERT INTO semantic (claim, confidence, domain, distilled_from, embedding)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.claim, data.confidence, data.domain, data.distilled_from, data.embedding);
  }

  public close(): void {
    this.db.close();
  }
}
