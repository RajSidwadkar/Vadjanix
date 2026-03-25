import { SimplePool, finalizeEvent } from 'nostr-tools';
import { AgentIdentity } from '../src/config/identity.js';

/**
 * Agent Card (A2A Standard Metadata)
 */
const AgentCard = {
  name: "Vadjanix",
  about: "Autonomous negotiation and routing agent.",
  pubkey: AgentIdentity.publicKey,
  capabilities: ["deterministic_routing", "negotiation_engine", "file_management"],
  supported_actions: ["read", "write", "propose", "query", "call", "refuse"],
  reply_to: `vadjanix://${AgentIdentity.publicKey}`
};

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();

async function publishAgentCard() {
  try {
    console.log("[AGENT-CARD] Preparing to broadcast Vadjanix identity...");

    // 1. Create the Nostr event (Kind 0)
    const eventTemplate = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(AgentCard),
    };

    // 2. Sign the event
    const privateKeyBytes = Buffer.from(AgentIdentity.privateKey, 'hex');
    const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

    // 3. Publish to relays
    console.log(`[AGENT-CARD] Broadcasting to: ${RELAYS.join(', ')}`);
    const pubs = pool.publish(RELAYS, signedEvent);
    
    // Wait for at least one relay to acknowledge
    await Promise.any(pubs);

    console.log("\n" + "=".repeat(60));
    console.log("   🚀 SUCCESS: VADJANIX AGENT CARD BROADCAST COMPLETE! 🚀");
    console.log("=".repeat(60));
    console.log(`Identity Pubkey : ${AgentIdentity.publicKey}`);
    console.log(`Discovery URI   : vadjanix://${AgentIdentity.publicKey}`);
    console.log("=".repeat(60) + "\n");

  } catch (error: any) {
    console.error(`\n[AGENT-CARD] FATAL ERROR: ${error.message}\n`);
  } finally {
    // 4. Elegant cleanup
    console.log("[AGENT-CARD] Closing relay pool connections...");
    pool.close(RELAYS);
    process.exit(0);
  }
}

// Execute
publishAgentCard();
