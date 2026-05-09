import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VadjanixMemory } from '../src/modules/memory/system.js';
import { MemoryStore } from '../src/modules/memory/store.js';
import { CognitiveEngine } from '../src/modules/memory/engine.js';
import Database from 'better-sqlite3';

describe('VadjanixMemory System', () => {
  const testDbPath = 'memory/memory_test.db';
  let memory: VadjanixMemory;
  let store: MemoryStore;
  let cognitive: CognitiveEngine;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    store = new MemoryStore(testDbPath);
    cognitive = new CognitiveEngine();
    memory = new VadjanixMemory(store, cognitive);
  });

  afterEach(() => {
    memory.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should write an episode and retrieve it', async () => {
    const episodeId = await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'user1',
      raw_exchange: 'Hello Vadjanix',
      agent_action: 'Responded nicely',
      outcome: 'success',
      emotional_valence: 0.5,
      importance: 0.5
    });

    expect(episodeId).toBeDefined();

    const result = await memory.retrieve('Hello');
    expect(result.episodic.length).toBeGreaterThan(0);
    expect(result.episodic[0].raw_exchange).toBe('Hello Vadjanix');
    expect(result.episodic[0].read_only).toBe(0);
  });

  it('should enforce protection for JIDs in CONTACTS.json', async () => {
    // JID1 is protected in config/CONTACTS.json
    const episodeId = await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'JID1',
      raw_exchange: 'Secret message from protected contact',
      agent_action: 'This should be null',
      outcome: 'neutral',
      emotional_valence: 0.0,
      importance: 1.0
    });

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT * FROM episodic WHERE id = ?').get(episodeId) as any;
    expect(row.agent_action).toBeNull();
    expect(row.read_only).toBe(1);
    db.close();

    // Retrieval should NOT include it by default
    const result = await memory.retrieve('Secret message');
    expect(result.episodic.find(e => e.id === Number(episodeId))).toBeUndefined();

    // Retrieval SHOULD include it if requested
    const resultWithReadOnly = await memory.retrieve('Secret message', 5, true);
    expect(resultWithReadOnly.episodic.find(e => e.id === Number(episodeId))).toBeDefined();
  });

  it('should write causal edges', () => {
    memory.writeCausalEdge('A', 'B', 0.9, 'C', 'M', 'E', 1);
    const db = new Database(testDbPath);
    const row = db.prepare('SELECT * FROM causal_graph WHERE cause = ?').get('A') as any;
    expect(row).toBeDefined();
    expect(row.effect).toBe('B');
    expect(row.evidence).toBe('E');
    db.close();
  });

  it('should use default success_rate in procedural table', () => {
    const db = new Database(testDbPath);
    db.prepare('INSERT INTO procedural (condition_text, action_text, source) VALUES (?, ?, ?)').run('cond', 'act', 'src');
    const row = db.prepare('SELECT * FROM procedural WHERE source = ?').get('src') as any;
    expect(row.success_rate).toBe(0.5);
    db.close();
  });
});
