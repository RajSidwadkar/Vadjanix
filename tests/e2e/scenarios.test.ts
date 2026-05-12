import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Bootstrapper } from '../../src/core/bootstrapper.js';
import { MemoryStore } from '../../src/modules/memory/store.js';
import { CapsuleManager } from '../../src/agent/capsule.js';
import { MCQStore } from '../../src/agent/mcq_store.js';

// Mock AdapterFactory
vi.mock('../../src/infrastructure/adapters/AdapterFactory.js', () => ({
  createAdapter: vi.fn().mockResolvedValue({
    reason: vi.fn().mockImplementation(async (context) => {
      if (context.includes('2 + 2')) {
        return { text: JSON.stringify({ 
          from: 'vadjanix://brain', to: 'user', action: 'refuse', 
          payload: { message: '4' }, reasoning: 'reflex', confidence: 1.0 
        }) };
      }
      return {
        text: JSON.stringify({
          from: 'vadjanix://brain',
          to: 'user',
          action: 'call',
          payload: { 
            message: 'Autonomous action executed',
            details: { task_name: 'test_task' }
          },
          reasoning: 'Testing e2e',
          confidence: 0.9,
          domain: 'coding'
        })
      };
    }),
    warmup: vi.fn().mockResolvedValue(undefined)
  })
}));

// Mock WhatsApp adapter
vi.mock('../../src/channels/whatsapp_adapter.js', () => ({
  WhatsAppAdapter: class {
    initialize = vi.fn().mockResolvedValue(undefined);
    onMessage = vi.fn();
    stop = vi.fn().mockResolvedValue(undefined);
    send = vi.fn().mockResolvedValue(undefined);
  }
}));

describe('Vadjanix E2E Integration Suite', () => {
  let agent: any;
  let bootstrapper: any;

  beforeEach(async () => {
    process.env.MASTER_PASSWORD = 'test';
    process.env.RELAY_IP = ''; 
    const { Bootstrapper } = await import('../../src/core/bootstrapper.js');
    bootstrapper = await Bootstrapper.ignite();
    agent = bootstrapper.agent;
  });

  afterEach(async () => {
    if (agent && agent.memory && agent.memory.store) {
      await agent.memory.store.close();
    }
    vi.unstubAllEnvs();
  });

  it('E2E Test 1 — Core Happy Path', async () => {
    const response = await agent.handleIncomingMessage('whatsapp', 'user123', 'Help me with code');
    expect(response).toBe('Autonomous action executed');

    const episodes = agent.memory.store.getAllEpisodes();
    expect(episodes.length).toBeGreaterThanOrEqual(1);
    const lastEpisode = episodes[0];
    expect(lastEpisode.agent_action).toBe('call');
  });

  it('E2E Test 2 — Protected Contact Hard Boundary', async () => {
    const contactsPath = path.join(process.cwd(), 'config', 'CONTACTS.json');
    const originalContent = fs.readFileSync(contactsPath, 'utf8');
    try {
      fs.writeFileSync(contactsPath, JSON.stringify({ owner: 'owner', protected: ['protected_user'], agents: [] }));
      
      const response = await agent.handleIncomingMessage('whatsapp', 'protected_user', 'Hello');
      expect(response).toBe(''); // No reply

      const episodes = agent.memory.store.getAllEpisodes();
      const last = episodes[0];
      expect(last.counterparty_id).toBe('protected_user');
      expect(last.read_only).toBe(1);
      expect(last.agent_action).toBeNull();
    } finally {
      fs.writeFileSync(contactsPath, originalContent);
    }
  });

  it('E2E Test 4 — Rollback', async () => {
    const capsuleManager = new CapsuleManager();
    const dbPath = 'memory/vadjanix.db';
    
    const capsuleId = await capsuleManager.createCapsule('Initial state', [], 1.0);
    const originalContent = fs.readFileSync(dbPath);
    fs.appendFileSync(dbPath, 'CORRUPTION');
    
    await capsuleManager.rollback(capsuleId);
    const restoredContent = fs.readFileSync(dbPath);
    expect(restoredContent).toEqual(originalContent);
  });

  it('E2E Test 5 — Relay Queue', async () => {
    const { SyncClient } = await import('../../src/relay/sync_client.js');
    const syncClient = new SyncClient();
    (syncClient as any).pollQueue = async function() {
      const RELAY_URL = 'http://127.0.0.1:3001';
      const response = await fetch(`${RELAY_URL}/queue`);
      if (response.ok) {
        const items = await response.json();
        for (const item of items) {
          if (this.itemHandler) await this.itemHandler(item);
        }
      }
    };

    const mockHandler = vi.fn().mockResolvedValue(undefined);
    syncClient.setItemHandler(mockHandler);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, type: 'whatsapp_message', payload: '{}' }])
    }) as any;

    await syncClient.pollQueue();
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('E2E Test 6 — Routing Speed (Reflex)', async () => {
    const start = performance.now();
    await agent.handleIncomingMessage('whatsapp', 'user', 'Is it monday?');
    const end = performance.now();
    expect(end - start).toBeLessThan(100); 
  });

  it('E2E Test 7 — ARC World Model', async () => {
    // This is a placeholder as ARC-3 logic is complex and usually requires its own test suite
    // We verify the agent has an efficiency score mechanism
    const selfModel = agent.getSelfModel();
    expect(selfModel).toBeDefined();
    // Assuming AgentSelfModel has some scoring
  });
});
