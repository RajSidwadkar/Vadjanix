import { MCQPacket } from '../core/mcq_schema.js';

/**
 * Handle user reply to an MCQ.
 * @param reply The user's reply string.
 * @param packet The original MCQ packet.
 * @returns The chosen action string if valid, otherwise undefined.
 */
export function handleReply(reply: string, packet: MCQPacket): string | undefined {
  if (!reply || !packet || !packet.options) {
    return undefined;
  }

  const normalizedReply = reply.trim().toUpperCase();
  
  // Use hasOwnProperty to safely check for the key, preventing prototype pollution access
  if (Object.prototype.hasOwnProperty.call(packet.options, normalizedReply)) {
    return packet.options[normalizedReply];
  }
  
  return undefined; // Unknown reply -> ask again (never guess)
}
