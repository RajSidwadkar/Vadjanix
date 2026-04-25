import assert from 'node:assert';
import fs from 'node:fs';
import { VadjanixMemory } from '../../src/modules/memory/system.js';
import { MemoryStore } from '../../src/modules/memory/store.js';
import { CognitiveEngine } from '../../src/modules/memory/engine.js';
import Database from 'better-sqlite3';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const testDbPath = 'memory/memory_test.db';
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const store = new MemoryStore(testDbPath);
  const cognitive = new CognitiveEngine();
  const memory = new VadjanixMemory(store, cognitive);

  await runTest('Test 1: Embedding & Episodic Storage', async () => {
    await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'user1',
      raw_exchange: 'User asked about the weather',
      agent_action: 'Checked weather tool',
      outcome: 'success',
      emotional_valence: 0.5,
      importance: 0.8
    });
    const db = new Database(testDbPath);
    const row = db.prepare('SELECT * FROM episodic WHERE raw_exchange = ?').get('User asked about the weather') as any;
    assert.ok(row);
    assert.ok(Buffer.isBuffer(row.embedding));
    db.close();
  });

  await runTest('Test 2: Scored Retrieval', async () => {
    await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'user1',
      raw_exchange: 'It is raining outside today',
      agent_action: 'None',
      outcome: 'neutral',
      emotional_valence: 0.3,
      importance: 0.5
    });
    const result = await memory.retrieve('Tell me about the weather', 2);
    assert.strictEqual(result.episodic.length, 2);
    assert.ok(Array.isArray(result.semantic));
  });

  await runTest('Test 3: Causal Graph Integrity', async () => {
    memory.writeCausalEdge('Heavy rain', 'Flood risk', 0.85, 'Saturated soil', 'Surface runoff', 'ep-1,ep-2', 1);
    const db = new Database(testDbPath);
    const row = db.prepare('SELECT * FROM causal_graph WHERE cause = ?').get('Heavy rain') as any;
    assert.ok(row);
    assert.strictEqual(row.effect, 'Flood risk');
    db.close();
  });

  memory.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.exit(0);
}

main();
