import 'dotenv/config';

const privateKey = process.env.NOSTR_PRIVATE_KEY;
const publicKey = process.env.NOSTR_PUBLIC_KEY;

if (!privateKey || !publicKey) {
  throw new Error("FATAL: Nostr identity (NOSTR_PRIVATE_KEY or NOSTR_PUBLIC_KEY) missing from .env");
}

/**
 * AgentIdentity
 * Global configuration for the local Vadjanix agent's cryptographic identity.
 */
export const AgentIdentity = {
  privateKey,
  publicKey
};
