import { IntentPacket } from '../router/schema.js';

const SESSION_LIMIT = 20;
const SESSION_STORE: Map<string, number> = new Map();

export function checkRateLimit(sessionId: string): boolean {
  const currentCount = SESSION_STORE.get(sessionId) || 0;
  if (currentCount >= SESSION_LIMIT) {
    return false;
  }
  SESSION_STORE.set(sessionId, currentCount + 1);
  return true;
}

export function getLimitExceededResponse(sessionId: string): IntentPacket {
  return {
    from: 'vadjanix://brain',
    to: 'user',
    action: 'refuse',
    payload: { 
      message: 'Rate limit exceeded. Maximum compute sessions reached.' 
    },
    reasoning: `Session ${sessionId} reached max tool execution limit (${SESSION_LIMIT}).`
  };
}
