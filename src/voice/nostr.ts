import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { AgentIdentity } from '../config/identity.js';
import { IntentPacket, IntentPacketSchema } from '../router/schema.js';
import { logSecurityEvent } from '../router/audit.js';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();

export async function nostrSend(packet: IntentPacket): Promise<boolean> {
  try {
    let targetPubKey = packet.to;
    try {
      if (targetPubKey.includes('://')) {
        const url = new URL(targetPubKey);
        targetPubKey = url.hostname;
      } else if (targetPubKey.includes(':')) {
        const url = new URL(targetPubKey);
        targetPubKey = url.pathname;
      }
    } catch (e) {
      targetPubKey = targetPubKey.replace('vadjanix://', '').replace('vadjanix:', '');
    }
    targetPubKey = targetPubKey.split('/')[0];

    if (!/^[0-9a-fA-F]{64}$/.test(targetPubKey)) {
      throw new Error(`Invalid destination pubkey: ${targetPubKey}`);
    }

    const eventTemplate = {
      kind: 29999,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', targetPubKey]],
      content: JSON.stringify(packet),
    };

    const privateKeyBytes = Buffer.from(AgentIdentity.privateKey, 'hex');
    const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

    console.log(`[NOSTR] Attempting to broadcast to relays for ${targetPubKey}...`);
    const pubs = pool.publish(DEFAULT_RELAYS, signedEvent);
    
    await Promise.any(pubs);
    
    console.log(`[NOSTR] Packet broadcasted successfully to at least one relay.`);
    return true;
  } catch (error: any) {
    console.error(`[NOSTR] Send failed: ${error.message}`);
    return false;
  }
}

export function nostrListen(onPacketReceived: (packet: any) => void) {
  const pubkey = AgentIdentity.publicKey;
  console.log(`[NOSTR] Starting listener for kind 29999, targeting pubkey: ${pubkey}`);

  const sub = pool.subscribeMany(
    DEFAULT_RELAYS,
    [
      {
        kinds: [29999],
        '#p': [pubkey],
      },
    ],
    {
      onevent(event) {
        if (!verifyEvent(event)) {
          logSecurityEvent('Signature Failure', `Nostr pubkey ${event.pubkey}`, 'Invalid Ed25519 signature');
          return;
        }

        let parsedJson: any;
        try {
          parsedJson = JSON.parse(event.content);
        } catch (e) {
          logSecurityEvent('JSON Parse Failure', `Nostr pubkey ${event.pubkey}`, event.content);
          return;
        }

        const result = IntentPacketSchema.safeParse(parsedJson);
        if (!result.success) {
          logSecurityEvent(`Zod Schema Failure | ${result.error.message}`, `Nostr pubkey ${event.pubkey}`, event.content);
          return;
        }

        const packet = result.data;
        const senderPubkey = packet.from.replace('vadjanix://', '').replace('vadjanix:', '').split('/')[0];
        if (senderPubkey !== event.pubkey) {
          logSecurityEvent('Pubkey Mismatch', `Nostr event pubkey ${event.pubkey}`, `Packet declares from: ${packet.from}`);
          return;
        }

        console.log(`[NOSTR] Received verified packet from ${event.pubkey}`);
        onPacketReceived(packet);
      },
      oneose() {
        console.log("[NOSTR] Relay subscription reached End of Stored Events (EOSE).");
      },
      onclosed(reasons: string[]) {
        console.warn("[NOSTR] Subscription closed:", reasons);
      }
    }
  );

  return sub;
}

