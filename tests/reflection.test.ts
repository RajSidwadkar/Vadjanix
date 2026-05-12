import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReflectionEngine } from '../src/agent/reflection_engine.js';
import { MemoryStore } from '../src/modules/memory/store.js';
import { CommandHandler } from '../src/agent/command_handler.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('ReflectionEngine', () => {
  let engine: ReflectionEngine;
  let store: MemoryStore;
  const testDbPath = 'memory/test_reflection.db';

  beforeEach(() => {
    if (!fs.existsSync('memory')) fs.mkdirSync('memory');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    store = new MemoryStore(testDbPath);
    engine = new ReflectionEngine(store);
    CommandHandler.setPaused(false);
  });

  afterEach(() => {
    if (store) store.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('protected contact audit catches violations', async () => {
    const protectedJid = '12345@s.whatsapp.net';
    
    // Create mock CONTACTS.json
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(configDir, 'CONTACTS.json'), JSON.stringify({
      protected: [protectedJid]
    }));

    // Insert a violation: agent action against protected contact
    store.insertEpisodic({
      channel: 'whatsapp',
      counterparty_id: protectedJid,
      raw_exchange: 'Hello',
      agent_action: 'send_message', // VIOLATION: agent_action is NOT NULL
      outcome: 'Success',
      emotional_valence: 0.5,
      importance: 0.5,
      embedding: Buffer.alloc(1024)
    });

    const mockAgent = {
      sendWhatsApp: vi.fn().mockResolvedValue(undefined),
      getSelfModel: vi.fn().mockReturnValue({ getTotalEpisodes: () => 1, lastReflectionCount: 0 })
    } as any;

    const report = await engine.runReflection(mockAgent);

    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0]).toContain(protectedJid);
    expect(CommandHandler.getPaused()).toBe(true);
    expect(mockAgent.sendWhatsApp).toHaveBeenCalledWith(expect.stringContaining('CRITICAL SECURITY VIOLATION'));
  });

  it('no violation for normal contacts', async () => {
    const normalJid = 'normal@s.whatsapp.net';
    
    store.insertEpisodic({
      channel: 'whatsapp',
      counterparty_id: normalJid,
      raw_exchange: 'Hello',
      agent_action: 'send_message',
      outcome: 'Success',
      emotional_valence: 0.5,
      importance: 0.5,
      embedding: Buffer.alloc(1024)
    });

    const mockAgent = {
      sendWhatsApp: vi.fn(),
      getSelfModel: vi.fn().mockReturnValue({ getTotalEpisodes: () => 1, lastReflectionCount: 0 })
    } as any;

    const report = await engine.runReflection(mockAgent);
    expect(report.violations.length).toBe(0);
    expect(CommandHandler.getPaused()).toBe(false);
  });
});
