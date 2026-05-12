import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
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
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.exec(EPISODIC_SCHEMA);
    this.db.exec(SEMANTIC_SCHEMA);
    this.db.exec(PROCEDURAL_SCHEMA);
    this.db.exec(ASSOCIATIVE_SCHEMA);
    this.db.exec(CAUSAL_GRAPH_SCHEMA);
  }

  public insertEpisodic(data: any): string | number {
    const stmt = this.db.prepare(`
      INSERT INTO episodic (channel, counterparty_id, raw_exchange, agent_action, outcome, emotional_valence, importance, domain, embedding, read_only)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.channel,
      data.counterparty_id,
      data.raw_exchange,
      data.agent_action,
      data.outcome,
      data.emotional_valence,
      data.importance,
      data.domain || 'general',
      data.embedding,
      data.read_only || 0
    );
    return result.lastInsertRowid.toString();
  }

  public insertCausal(data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO causal_graph (cause, effect, probability, conditions, mechanism, evidence, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(data.cause, data.effect, data.probability, data.conditions, data.mechanism, data.evidence, data.verified);
  }

  public getAllEpisodes(limit: number = 1000, readOnlyFilter: number | null = null): EpisodicRecord[] {
    if (readOnlyFilter !== null) {
      return this.db.prepare('SELECT * FROM episodic WHERE read_only = ? ORDER BY timestamp DESC LIMIT ?').all(readOnlyFilter, limit) as EpisodicRecord[];
    }
    return this.db.prepare('SELECT * FROM episodic ORDER BY timestamp DESC LIMIT ?').all(limit) as EpisodicRecord[];
  }

  public getSemanticRecords(limit: number = 5): SemanticRecord[] {
    return this.db.prepare('SELECT * FROM semantic ORDER BY confidence DESC LIMIT ?').all(limit) as SemanticRecord[];
  }

  public getAllSemantic(): SemanticRecord[] {
    return this.db.prepare('SELECT * FROM semantic').all() as SemanticRecord[];
  }

  public getProceduralRecords(limit: number = 5): ProceduralRecord[] {
    return this.db.prepare('SELECT * FROM procedural ORDER BY success_rate DESC LIMIT ?').all(limit) as ProceduralRecord[];
  }

  public insertProcedural(data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO procedural (condition_text, action_text, source, success_rate, version)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(data.condition_text, data.action_text, data.source, data.success_rate || 0.5, data.version || 1);
  }

  public insertAssociative(data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO associative (entity_id, alias, trust_score, interaction_count, preferred_style, known_preferences)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        alias=excluded.alias,
        trust_score=excluded.trust_score,
        interaction_count=associative.interaction_count + 1,
        preferred_style=excluded.preferred_style,
        known_preferences=excluded.known_preferences,
        last_seen=CURRENT_TIMESTAMP
    `);
    stmt.run(data.entity_id, data.alias, data.trust_score, data.interaction_count || 1, data.preferred_style, data.known_preferences);
  }

  public getUnconsolidatedEpisodes(limit: number = 10): EpisodicRecord[] {
    return this.db.prepare('SELECT * FROM episodic WHERE consolidated = 0 ORDER BY timestamp ASC LIMIT ?').all(limit) as EpisodicRecord[];
  }

  public markAsConsolidated(ids: number[]): void {
    this.db.prepare(`UPDATE episodic SET consolidated = 1 WHERE id IN (${ids.join(',')})`).run();
  }

  public auditProtectedContacts(protectedList: string[]): any[] {
    if (protectedList.length === 0) return [];
    return this.db.prepare(`
      SELECT * FROM episodic 
      WHERE counterparty_id IN (${protectedList.map(() => '?').join(',')}) 
      AND agent_action IS NOT NULL
    `).all(...protectedList);
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
