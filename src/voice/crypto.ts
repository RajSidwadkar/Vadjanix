import { getPublicKey } from 'nostr-tools';
import { schnorr } from '@noble/curves/secp256k1.js';
import { IntentPacket } from '../router/schema.js';
import crypto from 'node:crypto';

/**
 * Signs an IntentPacket using a Nostr private key.
 * 1. Strips existing 'auth' field.
 * 2. Deterministically stringifies the packet.
 * 3. Hashes with SHA-256.
 * 4. Signs with Schnorr.
 */
export async function signPacket(packet: IntentPacket, privateKeyHex: string): Promise<IntentPacket> {
  const { auth, ...rest } = packet;
  const json = JSON.stringify(sortObject(rest));
  const hash = crypto.createHash('sha256').update(json).digest();
  const sig = schnorr.sign(hash, Buffer.from(privateKeyHex, 'hex'));
  const sigHex = Buffer.from(sig).toString('hex');
  return { ...packet, auth: sigHex };
}

/**
 * Verifies the Schnorr signature of an IntentPacket.
 */
export async function verifyPacketSignature(packet: IntentPacket, publicKeyHex: string): Promise<boolean> {
  if (!packet.auth) return false;
  const { auth, ...rest } = packet;
  const json = JSON.stringify(sortObject(rest));
  const hash = crypto.createHash('sha256').update(json).digest();
  try {
    return schnorr.verify(Buffer.from(packet.auth, 'hex'), hash, Buffer.from(publicKeyHex, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Deep sorts object keys for deterministic JSON stringification.
 */
function sortObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj)
    .sort()
    .reduce((acc: any, key: string) => {
      acc[key] = sortObject(obj[key]);
      return acc;
    }, {});
}
