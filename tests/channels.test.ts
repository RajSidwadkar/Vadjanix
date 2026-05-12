import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../src/channels/session_manager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('getSession() creates a new session if none exists', () => {
    const session = manager.getSession('user1');
    expect(session.counterpartyId).toBe('user1');
    expect(session.context).toEqual({});
  });

  it('updateSession() updates existing session', () => {
    manager.updateSession('user1', 'whatsapp', { context: { foo: 'bar' } });
    const session = manager.getSession('user1');
    expect(session.lastChannel).toBe('whatsapp');
    expect(session.context.foo).toBe('bar');
  });

  it('routeUrgent() routes to primary channel with prefix', async () => {
    const mockAdapter = {
      send: vi.fn().mockResolvedValue(undefined)
    };
    const adapters = new Map([['whatsapp', mockAdapter]]);
    
    await manager.routeUrgent('owner_jid', 'whatsapp', 'System Failure', adapters as any);
    
    expect(mockAdapter.send).toHaveBeenCalledWith('owner_jid', '🚨 URGENT: System Failure');
  });

  it('sessions expire after inactivity (mocked)', () => {
    // This is hard to test without manual clock control in the Map, 
    // but we can verify the getSession cleanup logic if we could mock Date.now()
    const now = Date.now();
    vi.useFakeTimers();
    
    manager.updateSession('user1', 'whatsapp', {});
    
    // Fast forward 25 hours
    vi.setSystemTime(now + (25 * 60 * 60 * 1000));
    
    // The internal cleanup in getSession should remove it
    const session = manager.getSession('user1');
    // Note: our getSession currently creates a NEW one if missing. 
    // To verify it was deleted and recreated:
    expect(session.lastChannel).toBe(''); // New session has empty lastChannel
    
    vi.useRealTimers();
  });
});
