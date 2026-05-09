import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert';
import { CapsuleManager } from '../../src/agent/capsule.js';

async function runTests() {
  console.log('Starting Capsule System Tests...');
  const manager = new CapsuleManager();
  
  // Ensure target files exist for hashing
  if (!fs.existsSync('soul')) fs.mkdirSync('soul');
  fs.writeFileSync('soul/PRINCIPLES.json', JSON.stringify({ version: 1 }));
  fs.writeFileSync('GOALS.md', 'Initial Goals');
  if (!fs.existsSync('memory')) fs.mkdirSync('memory');
  fs.writeFileSync('memory/vadjanix.db', 'database content');

  const getHash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const initialHash = getHash('GOALS.md');

  console.log('1. Creating first capsule...');
  await manager.createCapsule('Initial state', ['Init'], 100);

  console.log('2. Modifying state and creating second capsule...');
  fs.writeFileSync('GOALS.md', 'Modified Goals');
  const modifiedHash = getHash('GOALS.md');
  const capId2 = await manager.createCapsule('Modified state', ['Mod'], 100);

  console.log('3. Rolling back to first capsule...');
  const rollbackResult = await manager.rollback();
  console.log('Rollback result:', rollbackResult);

  const restoredHash = getHash('GOALS.md');
  assert.strictEqual(restoredHash, initialHash, 'State restoration failed: Hash mismatch');
  console.log('[PASS] State restored successfully');

  console.log('4. Verifying chain...');
  const isChainValid = await manager.verifyChain();
  assert.ok(isChainValid, 'Chain verification failed');
  console.log('[PASS] Chain verification successful');

  console.log('5. Testing Semantic Diff...');
  const diff = manager.buildSemanticDiff(['Updated principles', 'Added goal'], 95, true);
  console.log('Generated Diff:\n' + diff);
  assert.ok(diff.includes('📋 PROPOSED CHANGES'));

  console.log('All capsule tests PASSED.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
