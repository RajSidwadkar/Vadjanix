import { SimplePool, finalizeEvent } from 'nostr-tools';
import { AgentIdentity } from '../config/identity.js';
import { IntentPacket, IntentPacketSchema } from '../router/schema.js';
import { logSecurityEvent } from '../router/audit.js';

// Default Nostr relays
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();
// ... (nostrSend remains the same)
/**
 * Sends an IntentPacket via Nostr network as an ephemeral event (kind 29999).
 * @param packet The IntentPacket to be sent.
 * @returns Success boolean.
 */
export async function nostrSend(packet: IntentPacket): Promise<boolean> {
  try {
    // 1. Parse packet.to to extract destination pubkey
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
      // Fallback manual stripping
      targetPubKey = targetPubKey.replace('vadjanix://', '').replace('vadjanix:', '');
    }
    // Handle cases like vadjanix://pubkey/path or vadjanix:pubkey/path
    targetPubKey = targetPubKey.split('/')[0];

    // Basic validation of pubkey
    if (!/^[0-9a-fA-F]{64}$/.test(targetPubKey)) {
      throw new Error(`Invalid destination pubkey: ${targetPubKey}`);
    }

    // 2. Wrap packet into Nostr event object (kind 29999)
    const eventTemplate = {
      kind: 29999,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', targetPubKey]],
      content: JSON.stringify(packet),
    };

    // 3. Sign the Nostr event
    const privateKeyBytes = Buffer.from(AgentIdentity.privateKey, 'hex');
    const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

    // 4. Publish to relays
    console.log(`[NOSTR] Attempting to broadcast to relays for ${targetPubKey}...`);
    const pubs = pool.publish(DEFAULT_RELAYS, signedEvent);
    
    // Wait for at least one success
    await Promise.any(pubs);
    
    console.log(`[NOSTR] Packet broadcasted successfully to at least one relay.`);
    return true;
  } catch (error: any) {
    console.error(`[NOSTR] Send failed: ${error.message}`);
    return false;
  }
}

/**
 * Listens for kind 29999 Nostr events addressed to this agent.
 * @param onPacketReceived Callback for when a packet is received.
 */
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

        console.log(`[NOSTR] Received valid packet from ${event.pubkey}`);
        onPacketReceived(result.data);
      },
      oneose() {
        console.log("[NOSTR] Relay subscription reached End of Stored Events (EOSE).");
      },
      onclosed(reasons) {
        console.warn("[NOSTR] Subscription closed:", reasons);
      }
    }
  );

  return sub;
}
