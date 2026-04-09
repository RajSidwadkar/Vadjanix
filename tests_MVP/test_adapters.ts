import assert from 'node:assert';
import { routePacket } from '../src/router/index.js';
import { IntentPacket } from '../src/router/schema.js';

async function runTests() {
  console.log("🚀 Starting Bridge Adapter Routing Tests...");

  try {
    // Test 1: Route to Google A2A
    console.log("\n[TEST 1] Routing to google-a2a://");
    const googlePacket: IntentPacket = {
      from: "vadjanix://brain",
      to: "google-a2a://assistant-123",
      action: "write",
      payload: { message: "Hello Google Assistant" },
      reasoning: "Cross-platform communication test."
    };
    
    const result1 = await routePacket(googlePacket);
    assert.strictEqual(result1.success, true);
    assert.strictEqual(result1.data.adapter, "google-a2a");
    console.log("[PASS] Correctly routed to Google A2A adapter.");

    // Test 2: Route to OpenAI Agent
    console.log("\n[TEST 2] Routing to openai-agent://");
    const openaiPacket: IntentPacket = {
      from: "vadjanix://brain",
      to: "openai-agent://gpt-agent",
      action: "write",
      payload: { message: "Hello GPT Agent" },
      reasoning: "Cross-platform communication test."
    };
    
    const result2 = await routePacket(openaiPacket);
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.data.adapter, "openai-agent");
    console.log("[PASS] Correctly routed to OpenAI Agent adapter.");

    // Test 3: Fallback to standard protocol
    console.log("\n[TEST 3] Standard protocol (vadjanix://) in simulation mode");
    process.env.SIMULATION_MODE = 'true';
    const standardPacket: IntentPacket = {
      from: "vadjanix://brain",
      to: "vadjanix://other-agent",
      action: "write",
      payload: { message: "Hello peer" },
      reasoning: "Internal communication test."
    };
    
    const result3 = await routePacket(standardPacket);
    assert.strictEqual(result3.success, true);
    assert.ok(result3.data.message.includes("loopback"));
    console.log("[PASS] Standard protocol still works correctly.");

  } catch (error: any) {
    console.error(`\n[FAIL] Test Suite Crashed: ${error.message}`);
    process.exit(1);
  }

  console.log("\nALL ADAPTER TESTS PASSED!");
  process.exit(0);
}

runTests();
