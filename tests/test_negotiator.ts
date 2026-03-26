import assert from 'node:assert';
import { evaluateProposal } from '../src/brain/negotiator.js';

/**
 * Unit tests for the Negotiator Logic Engine
 */
async function runTests() {
  console.log("🚀 Starting Vadjanix Negotiator Logic Tests...");

  let totalTests = 0;
  let passedTests = 0;

  const test = (name: string, fn: () => void) => {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (error: any) {
      console.error(`[FAIL] ${name}: ${error.message}`);
    }
  };

  // --- Test 1: Walk Away Strategy ---
  test("Strategy: walk_away", () => {
    const packet = evaluateProposal('walk_away', 'buyer', 150, 100, 10);
    assert.strictEqual(packet.action, 'refuse');
    assert.ok(packet.payload.message.includes("walking away"));
    assert.strictEqual(packet.reasoning, "Walk away strategy chosen.");
  });

  // --- Test 2: Hold Firm Strategy ---
  test("Strategy: hold_firm", () => {
    const packet = evaluateProposal('hold_firm', 'seller', 160, 200, 10);
    assert.strictEqual(packet.action, 'propose');
    assert.strictEqual(packet.payload.details?.strategy, 'hold_firm');
    assert.ok(packet.payload.message.includes("$200"));
    assert.ok(packet.payload.message.includes("[FINAL OFFER]"));
  });

  // --- Test 3: Buyer Compromise (Price Goes Up) ---
  test("Strategy: compromise (Buyer)", () => {
    const packet = evaluateProposal('compromise', 'buyer', 150, 100, 10);
    assert.strictEqual(packet.action, 'propose');
    assert.ok(packet.payload.message.includes("$110"), "Buyer should move from 100 to 110");
  });

  // --- Test 4: Seller Compromise (Price Goes Down) ---
  test("Strategy: compromise (Seller)", () => {
    const packet = evaluateProposal('compromise', 'seller', 160, 200, 15);
    assert.strictEqual(packet.action, 'propose');
    assert.ok(packet.payload.message.includes("$185"), "Seller should move from 200 to 185");
  });

  // --- Test 5: Reaching the Limit (Buyer) ---
  test("Reaching Limit (Buyer)", () => {
    // Last offer 145, limit 150, step 10 -> Should be capped at 150
    const packet = evaluateProposal('compromise', 'buyer', 150, 145, 10);
    assert.ok(packet.payload.message.includes("$150"));
    assert.ok(packet.payload.message.includes("[FINAL OFFER]"));
    assert.strictEqual(packet.payload.details?.strategy, 'hold_firm', "Should mutate to hold_firm at limit");
  });

  // --- Test 6: Reaching the Limit (Seller) ---
  test("Reaching Limit (Seller)", () => {
    // Last offer 165, limit 160, step 10 -> Should be capped at 160
    const packet = evaluateProposal('compromise', 'seller', 160, 165, 10);
    assert.ok(packet.payload.message.includes("$160"));
    assert.ok(packet.payload.message.includes("[FINAL OFFER]"));
    assert.strictEqual(packet.payload.details?.strategy, 'hold_firm', "Should mutate to hold_firm at limit");
  });

  // --- Test 7: Already at Limit ---
  test("Already at Limit (Hold Firm)", () => {
    const packet = evaluateProposal('compromise', 'buyer', 150, 150, 10);
    assert.ok(packet.payload.message.includes("$150"));
    assert.strictEqual(packet.payload.details?.strategy, 'hold_firm');
  });

  console.log("\n-------------------------------------------");
  console.log(`Negotiator Tests: ${passedTests}/${totalTests} Passed`);
  console.log("-------------------------------------------");

  if (passedTests < totalTests) process.exit(1);
}

runTests();
