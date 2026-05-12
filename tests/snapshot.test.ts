import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SnapshotManager } from '../src/relay/snapshot_manager.js';
import { SecureVault } from '../src/security/vault.js';
import Database from 'better-sqlite3';

describe('SnapshotManager', () => {
  const TEST_DIR = 'test_snapshot_data';
  const vault = new SecureVault('test-password');
  const manager = new SnapshotManager();
  const DB_PATH = 'memory/vadjanix.db';

  beforeEach(() => {
    if (!fs.existsSync('soul')) fs.mkdirSync('soul');
    if (!fs.existsSync('memory')) fs.mkdirSync('memory');
    if (!fs.existsSync('capsules')) fs.mkdirSync('capsules');

    fs.writeFileSync('soul/PRINCIPLES.json', JSON.stringify({ version: 1, text: 'Test Principles' }));
    fs.writeFileSync('GOALS.md', '# Test Goals');
    
    // Create a real valid SQLite DB
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    const db = new Database(DB_PATH);
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)');
    db.prepare('INSERT INTO test (val) VALUES (?)').run('hello');
    db.close();

    fs.writeFileSync('capsules/cap_1.json', JSON.stringify({ id: 'cap_1', data: 'test' }));
  });

  afterEach(() => {
    const files = ['soul/PRINCIPLES.json', 'GOALS.md', 'memory/vadjanix.db', 'capsules/cap_1.json', 'narrative.md'];
    files.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  });

  it('should create and restore a snapshot successfully', async () => {
    const { data, checksum } = await manager.createSnapshot(vault);
    
    // Modify files to see if they are restored
    fs.writeFileSync('GOALS.md', '# Corrupted Goals');
    fs.writeFileSync('memory/vadjanix.db', Buffer.from([9, 8, 7]));

    const success = await manager.restoreSnapshot(data, checksum, vault);
    expect(success).toBe(true);

    const restoredGoals = fs.readFileSync('GOALS.md', 'utf8');
    expect(restoredGoals).toBe('# Test Goals');
    
    const db = new Database(DB_PATH);
    const row = db.prepare('SELECT val FROM test').get() as any;
    expect(row.val).toBe('hello');
    db.close();
  });

  it('should fail if checksum is corrupted', async () => {
    const { data, checksum } = await manager.createSnapshot(vault);
    const corruptedChecksum = checksum.split('').reverse().join('');
    
    const success = await manager.restoreSnapshot(data, corruptedChecksum, vault);
    expect(success).toBe(false);
  });

  it('should fail if data is corrupted', async () => {
    const { data, checksum } = await manager.createSnapshot(vault);
    const corruptedData = Buffer.from(data);
    corruptedData[20] ^= 0xFF; // Flip some bit in the encrypted part
    
    // Checksum should still match the data, but decryption should fail (GCM auth tag)
    const newChecksum = crypto.createHash('sha256').update(corruptedData).digest('hex');
    const success = await manager.restoreSnapshot(corruptedData, newChecksum, vault);
    expect(success).toBe(false);
  });
});
