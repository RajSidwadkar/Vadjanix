import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { VadjanixMemory } from '../src/memory/system.js';
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

  const memory = new VadjanixMemory(testDbPath);
  await memory.init();

  await runTest('Test 1: Xenova Embedding & Episodic Storage', async () => {
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
    assert.strictEqual(row.consolidated, 0);
    db.close();
  });

  await runTest('Test 2: Composite Scored Retrieval (Vector Math)', async () => {
    await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'user1',
      raw_exchange: 'It is raining outside today',
      agent_action: 'None',
      outcome: 'neutral',
      emotional_valence: 0.3,
      importance: 0.5
    });

    await memory.writeEpisode({
      channel: 'test',
      counterparty_id: 'user1',
      raw_exchange: 'Calculated prime numbers for a math problem',
      agent_action: 'Math tool',
      outcome: 'success',
      emotional_valence: 0.5,
      importance: 0.4
    });

    const result = await memory.retrieve('Tell me about the weather', 2);
    
    assert.strictEqual(result.episodic.length, 2);
    assert.ok(result.episodic[0].raw_exchange.includes('weather') || result.episodic[0].raw_exchange.includes('raining'));
    assert.ok(Array.isArray(result.semantic));
    assert.ok(Array.isArray(result.procedural));
  });

  await runTest('Test 3: Causal Graph Integrity', async () => {
    memory.writeCausalEdge(
      'Heavy rain',
      'Flood risk',
      0.85,
      'Saturated soil',
      'Surface runoff exceeds drainage capacity',
      'ep-1,ep-2',
      1
    );

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT * FROM causal_graph WHERE cause = ?').get('Heavy rain') as any;
    
    assert.ok(row);
    assert.strictEqual(row.effect, 'Flood risk');
    assert.strictEqual(row.probability, 0.85);
    db.close();
  });

  await runTest('Test 4: Consolidation Loop', async () => {
    process.env.DEFAULT_LLM = 'ollama';

    for (let i = 0; i < 8; i++) {
      await memory.writeEpisode({
        channel: 'test',
        counterparty_id: 'user1',
        raw_exchange: `Interaction sequence ${i}`,
        agent_action: 'Logging',
        outcome: 'noted',
        emotional_valence: 0.5,
        importance: 0.1
      });
    }

    const db = new Database(testDbPath);
    const unconsolidatedCount = db.prepare('SELECT COUNT(*) as count FROM episodic WHERE consolidated = 0').get() as any;
    
    assert.ok(unconsolidatedCount.count >= 10);

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('localhost:11434/api/generate')) {
        return {
          ok: true,
          json: async () => ({
            response: JSON.stringify({
              claim: 'Consolidated sequence of test interactions',
              confidence: 0.9,
              domain: 'test'
            })
          })
        } as Response;
      }
      return { ok: true } as Response;
    };

    await memory.maybeConsolidate();

    const consolidatedCount = db.prepare('SELECT COUNT(*) as count FROM episodic WHERE consolidated = 1').get() as any;
    const semanticCount = db.prepare('SELECT COUNT(*) as count FROM semantic').get() as any;

    assert.strictEqual(consolidatedCount.count, 10);
    assert.strictEqual(semanticCount.count, 1);
    global.fetch = originalFetch;
    db.close();
  });

  (memory as any).db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  console.log('\nSTATUS: COGNITIVE MEMORY VERIFIED. RETRIEVAL & CONSOLIDATION SECURE.');
  process.exit(0);
}

main();
