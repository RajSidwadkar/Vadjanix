import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { CapsuleManager, SovereigntyError } from '../../src/modules/memory/capsule.js';

const TEST_PRIVKEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function setup() {
  if (!fs.existsSync('memory')) fs.mkdirSync('memory');
  if (!fs.existsSync('soul')) fs.mkdirSync('soul');
  fs.writeFileSync('memory/vadjanix.db', 'MOCK_DB_STATE_1');
  fs.writeFileSync('soul/PRINCIPLES.json', 'MOCK_PRINCIPLES_1');
  fs.writeFileSync('GOALS.md', 'MOCK_GOALS_1');
  process.env.NOSTR_PRIVKEY = TEST_PRIVKEY;
}

async function teardown() {
  const dirs = ['./capsules', './.capsule_backups', 'memory', 'soul'];
  const files = ['GOALS.md'];
  
  for (const f of files) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  for (const d of dirs) {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  }
}

async function runTests() {
  try {
    await setup();
    const manager = new CapsuleManager();

    console.log('--- STARTING CAPSULE PROTOCOL TEST SUITE ---');

    await (async () => {
      const capsule = await manager.createCapsule("Attempting ARC Grid Transformation", ["Modified memory.db"], 0.85);
      assert.ok(capsule.id.startsWith('cap_'));
      assert.ok(capsule.signature);
      
      const manifestPath = path.join('./capsules', `${capsule.id}.json`);
      assert.ok(fs.existsSync(manifestPath));
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(manifest.signature, capsule.signature);

      const backupDb = path.join('./.capsule_backups', `${capsule.id}_memory_vadjanix.db`);
      assert.ok(fs.existsSync(backupDb));
      assert.strictEqual(fs.readFileSync(backupDb, 'utf-8'), 'MOCK_DB_STATE_1');
      
      console.log('[PASS] Test 1: Capsule Creation & Cryptographic Sealing');
    })();

    await (async () => {
      fs.writeFileSync('memory/vadjanix.db', 'CORRUPTED_STATE');
      fs.writeFileSync('soul/PRINCIPLES.json', 'CORRUPTED_PRINCIPLES');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.createCapsule("State before corruption", [], 1.0);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      fs.writeFileSync('memory/vadjanix.db', 'LATEST_CORRUPTION');
      await manager.createCapsule("Latest state", [], 1.0);
      
      await manager.rollback();
      
      const currentDb = fs.readFileSync('memory/vadjanix.db', 'utf-8');
      assert.strictEqual(currentDb, 'CORRUPTED_STATE');
      assert.strictEqual(fs.readFileSync('soul/PRINCIPLES.json', 'utf-8'), 'CORRUPTED_PRINCIPLES');

      const files = fs.readdirSync('./capsules').filter(f => f.endsWith('.json'));
      const sorted = files.map(f => JSON.parse(fs.readFileSync(path.join('./capsules', f), 'utf-8'))).sort((a, b) => a.timestamp - b.timestamp);
      await manager.rollback(sorted[0].id);

      assert.strictEqual(fs.readFileSync('memory/vadjanix.db', 'utf-8'), 'MOCK_DB_STATE_1');
      assert.strictEqual(fs.readFileSync('soul/PRINCIPLES.json', 'utf-8'), 'MOCK_PRINCIPLES_1');

      console.log('[PASS] Test 2: The Atomic Rollback (Mutation & Restoration)');
    })();

    await (async () => {
      delete process.env.NOSTR_PRIVKEY;
      try {
        await manager.createCapsule("Unsigned attempt", [], 0.5);
        assert.fail('Should have thrown SovereigntyError');
      } catch (e) {
        assert.ok(e instanceof SovereigntyError);
      }
      console.log('[PASS] Test 3: Sovereignty Error (Missing Ed25519 Key)');
    })();

    console.log('\nSTATUS: CAPSULE PROTOCOL SECURE. ATOMIC ROLLBACK OPERATIONAL.');
    process.exit(0);
  } catch (error) {
    console.error(`\n[FAIL] TEST SUITE CRITICAL ERROR:`, error);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();
