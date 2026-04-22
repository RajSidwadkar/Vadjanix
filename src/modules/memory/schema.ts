export interface EpisodicRecord {
  id: number;
  timestamp: string;
  channel: string;
  counterparty_id: string;
  raw_exchange: string;
  agent_action: string;
  outcome: string;
  emotional_valence: number;
  importance: number;
  consolidated: number;
  embedding: Buffer;
}

export interface SemanticRecord {
  id: number;
  claim: string;
  confidence: number;
  domain: string;
  last_updated: string;
  access_count: number;
  distilled_from: string;
  embedding: Buffer;
}

export interface ProceduralRecord {
  id: number;
  condition_text: string;
  action_text: string;
  source: string;
  success_rate: number;
  version: number;
}

export interface AssociativeRecord {
  entity_id: string;
  alias: string;
  trust_score: number;
  interaction_count: number;
  preferred_style: string;
  known_preferences: string;
  last_seen: string;
}

export interface CausalGraphRecord {
  id: number;
  cause: string;
  effect: string;
  probability: number;
  conditions: string;
  mechanism: string;
  evidence_episodes: string;
  verified: number;
}

export const EPISODIC_SCHEMA = `
  CREATE TABLE IF NOT EXISTS episodic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel TEXT NOT NULL,
    counterparty_id TEXT NOT NULL,
    raw_exchange TEXT NOT NULL,
    agent_action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    emotional_valence REAL NOT NULL,
    importance REAL NOT NULL,
    consolidated INTEGER DEFAULT 0,
    embedding BLOB NOT NULL
  );
`;

export const SEMANTIC_SCHEMA = `
  CREATE TABLE IF NOT EXISTS semantic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim TEXT NOT NULL,
    confidence REAL NOT NULL,
    domain TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    distilled_from TEXT NOT NULL,
    embedding BLOB NOT NULL
  );
`;

export const PROCEDURAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS procedural (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condition_text TEXT NOT NULL,
    action_text TEXT NOT NULL,
    source TEXT NOT NULL,
    success_rate REAL NOT NULL,
    version INTEGER DEFAULT 1
  );
`;

export const ASSOCIATIVE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS associative (
    entity_id TEXT PRIMARY KEY,
    alias TEXT NOT NULL,
    trust_score REAL NOT NULL,
    interaction_count INTEGER DEFAULT 0,
    preferred_style TEXT NOT NULL,
    known_preferences TEXT NOT NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CAUSAL_GRAPH_SCHEMA = `
  CREATE TABLE IF NOT EXISTS causal_graph (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cause TEXT NOT NULL,
    effect TEXT NOT NULL,
    probability REAL NOT NULL,
    conditions TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    evidence_episodes TEXT NOT NULL,
    verified INTEGER DEFAULT 0
  );
`;
