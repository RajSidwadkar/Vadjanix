import assert from 'node:assert';
import { 
  generateSecretKey, 
  getPublicKey, 
  finalizeEvent, 
  verifyEvent 
} from 'nostr-tools';

/**
 * Integration Test for Vadjanix Agent Card (Kind 0)
 * Verifies schema integrity, protocol compliance, and cryptographic validity.
 */
async function main() {
  console.log("====================================================");
  console.log("   VADJANIX AGENT CARD VALIDATION SUITE");
  console.log("====================================================\n");

  try {
    // --- Setup ---
    // Generate a throwaway keypair for the test
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    
    // In nostr-tools v2+, getPublicKey returns a hex string. 
    // If it returns bytes, we ensure it's converted to hex for comparison.
    const pkHex = typeof pk === 'string' ? pk : Buffer.from(pk).toString('hex');

    const AgentCard = {
      name: "Vadjanix",
      about: "Autonomous negotiation and routing agent.",
      pubkey: pkHex,
      capabilities: ["deterministic_routing", "negotiation_engine", "file_management"],
      supported_actions: ["read", "write", "propose", "query", "call", "refuse"],
      reply_to: `vadjanix://${pkHex}`
    };

    const eventTemplate = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(AgentCard),
    };

    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, sk);

    // --- Test 1: Content Schema Integrity ---
    console.log("[TEST] Content Schema Integrity...");
    const parsedContent = JSON.parse(signedEvent.content);
    
    assert.strictEqual(parsedContent.name, "Vadjanix", "Name must be 'Vadjanix'");
    assert.ok(Array.isArray(parsedContent.supported_actions), "supported_actions must be an array");
    assert.ok(parsedContent.supported_actions.includes("propose"), "supported_actions must include 'propose'");
    assert.strictEqual(parsedContent.reply_to, `vadjanix://${pkHex}`, "reply_to must match the A2A format");
    console.log("[PASS] Content Schema Integrity verified.");

    // --- Test 2: Nostr Protocol Compliance ---
    console.log("[TEST] Nostr Protocol Compliance...");
    assert.strictEqual(signedEvent.kind, 0, "Event kind must be 0 (Metadata)");
    assert.strictEqual(typeof signedEvent.created_at, 'number', "created_at must be a Unix timestamp");
    assert.strictEqual(signedEvent.pubkey, pkHex, "Event pubkey must match the signer's pubkey");
    console.log("[PASS] Nostr Protocol Compliance verified.");

    // --- Test 3: Cryptographic Verification ---
    console.log("[TEST] Cryptographic Verification...");
    const isValid = verifyEvent(signedEvent);
    assert.strictEqual(isValid, true, "Signature or hash failed cryptographic verification");
    console.log("[PASS] Cryptographic Verification verified.");

    console.log("\n====================================================");
    console.log("   ✅ ALL AGENT CARD TESTS PASSED ✅");
    console.log("====================================================");
    process.exit(0);

  } catch (error: any) {
    console.error(`\n[FAIL] Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("CATASTROPHIC ERROR:", err);
  process.exit(1);
});
