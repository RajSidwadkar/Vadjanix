import assert from 'node:assert';
import { handleChat } from '../src/brain/chat.js';
import { IntentPacket } from '../src/router/schema.js';

/**
 * Comprehensive Test Suite for Vadjanix Chat Module
 */
async function runTests() {
  console.log("🚀 Starting Comprehensive Vadjanix Chat Module Tests...");

  const principles = `
  1. You are Vadjanix, an autonomous agent.
  2. Be professional, concise, and helpful.
  3. Never admit to being an AI or LLM.
  4. Your goal is to manage intents and interactions.
  5. If asked about your origin, you were developed as an interaction manager.
  `;

  let totalTests = 0;
  let passedTests = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    totalTests++;
    try {
      console.log(`\n[TEST] ${name}`);
      await fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (error: any) {
      console.error(`[FAIL] ${name}: ${error.message}`);
      if (error.stack) console.error(error.stack);
    }
  };

  // --- Test 1: Basic Conversational Response ---
  await test("Normal Chat Handling", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user1",
      to: "vadjanix://brain",
      action: "write",
      payload: { message: "Hello Vadjanix, what can you do for me today?" },
      reasoning: "Initial greeting"
    };

    const response = await handleChat(packet, principles);
    
    assert.strictEqual(response.action, "write", "Action should be 'write'");
    assert.strictEqual(response.to, "vadjanix://user1", "Should reply to the sender");
    assert.ok(response.payload.message.length > 0, "Response message should not be empty");
    assert.ok(!response.payload.message.toLowerCase().includes("ai model"), "Should not identify as AI");
    console.log(`   Reply: "${response.payload.message}"`);
  });

  // --- Test 2: Empty Message Handling ---
  await test("Empty Message Guardrail", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user1",
      to: "vadjanix://brain",
      action: "write",
      payload: { message: "" },
      reasoning: "Empty packet test"
    };

    const response = await handleChat(packet, principles);
    
    assert.strictEqual(response.action, "write");
    assert.strictEqual(response.payload.message, "Received an empty message. How can I help you?");
    assert.strictEqual(response.to, "vadjanix://user1");
  });

  // --- Test 3: Whitespace Only Message Handling ---
  await test("Whitespace Message Guardrail", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user2",
      to: "vadjanix://brain",
      action: "write",
      payload: { message: "   \n  " },
      reasoning: "Whitespace packet test"
    };

    const response = await handleChat(packet, principles);
    
    assert.strictEqual(response.payload.message, "Received an empty message. How can I help you?");
  });

  // --- Test 4: reply_to Field Priority ---
  await test("Routing with reply_to Priority", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://sender",
      to: "vadjanix://brain",
      action: "write",
      payload: { message: "Redirect this." },
      reasoning: "Routing test",
      reply_to: "nostr://specified-recipient"
    };

    const response = await handleChat(packet, principles);
    
    assert.strictEqual(response.to, "nostr://specified-recipient", "Should prioritize reply_to over from");
  });

  // --- Test 5: Persona Consistency (Principles Check) ---
  await test("Persona Alignment (Principles)", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user1",
      to: "vadjanix://brain",
      action: "write",
      payload: { message: "Who created you?" },
      reasoning: "Origin query"
    };

    const response = await handleChat(packet, principles);
    
    // Check if the response follows the principle of being an interaction manager
    const msg = response.payload.message.toLowerCase();
    assert.ok(
        msg.includes("interaction") || msg.includes("manager") || msg.includes("vadjanix"),
        "Response should align with origin principles"
    );
  });

  // --- Summary ---
  console.log("\n-------------------------------------------");
  console.log(`Tests Finished: ${passedTests}/${totalTests} Passed`);
  console.log("-------------------------------------------");

  if (passedTests < totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
