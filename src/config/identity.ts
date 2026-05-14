import 'dotenv/config';
import { getPublicKey } from 'nostr-tools';

const privateKey = process.env.NOSTR_PRIVATE_KEY;
let publicKey = process.env.NOSTR_PUBLIC_KEY;

if (!privateKey || !publicKey) {
  throw new Error("FATAL: Nostr identity (NOSTR_PRIVATE_KEY or NOSTR_PUBLIC_KEY) missing from .env");
}

// Ensure publicKey is a valid 32-byte (64-char) hex string.
// If it's not, we derive it from the private key.
if (publicKey.length !== 64) {
  try {
    publicKey = getPublicKey(Buffer.from(privateKey, 'hex'));
  } catch (err) {
    throw new Error("FATAL: Failed to derive Nostr public key from private key.");
  }
}

/**
 * AgentIdentity
 * Global configuration for the local Vadjanix agent's cryptographic identity.
 */
export const AgentIdentity = {
  privateKey,
  publicKey
};
