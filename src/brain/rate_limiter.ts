import { IntentPacket } from '../router/schema.js';

export class RateLimiter {
  private sessionLimit: number;
  private sessionStore: Map<string, number>;

  constructor(limit: number = 20) {
    this.sessionLimit = limit;
    this.sessionStore = new Map();
  }

  public checkRateLimit(sessionId: string): boolean {
    const currentCount = this.sessionStore.get(sessionId) || 0;
    if (currentCount >= this.sessionLimit) {
      return false;
    }
    this.sessionStore.set(sessionId, currentCount + 1);
    return true;
  }

  public getLimitExceededResponse(sessionId: string): IntentPacket {
    return {
      from: 'vadjanix://brain',
      to: 'user',
      action: 'refuse',
      payload: { 
        message: 'Rate limit exceeded. Maximum compute sessions reached.' 
      },
      reasoning: `Session ${sessionId} reached max tool execution limit (${this.sessionLimit}).`
    };
  }
}
