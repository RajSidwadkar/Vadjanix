import { SessionState } from './types.js';


export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private readonly SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h

  public getSession(counterpartyId: string): SessionState {
    this._cleanup();
    let session = this.sessions.get(counterpartyId);
    if (!session) {
      session = {
        counterpartyId,
        lastChannel: '',
        lastInteraction: Date.now(),
        context: {}
      };
      this.sessions.set(counterpartyId, session);
    }
    return session;
  }

  public updateSession(counterpartyId: string, channel: string, partial: Partial<SessionState>): void {
    const session = this.getSession(counterpartyId);
    Object.assign(session, {
      ...partial,
      lastChannel: channel,
      lastInteraction: Date.now()
    });
    this.sessions.set(counterpartyId, session);
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastInteraction > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(id);
      }
    }
  }

  public async routeUrgent(ownerId: string, primaryChannel: string, message: string, adapters: Map<string, any>): Promise<void> {
    const adapter = adapters.get(primaryChannel);
    if (adapter) {
      await adapter.send(ownerId, `🚨 URGENT: ${message}`);
    }
  }
}
