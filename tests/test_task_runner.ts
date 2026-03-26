import assert from 'node:assert';
import { executeTask } from '../src/brain/task_runner.js';
import { IntentPacket } from '../src/router/schema.js';

async function runTests() {
  console.log("🚀 Starting Vadjanix Task Runner Tests...");

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
    }
  };

  // --- Test 1: Summarize Text ---
  await test("Task: summarize_text", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user",
      to: "vadjanix://brain",
      action: "call",
      payload: {
        message: "Summarize this for me.",
        details: {
          task_name: "summarize_text",
          parameters: { text: "Vadjanix is an autonomous agent based on Nostr." }
        }
      },
      reasoning: "Requesting text summary."
    };

    const response = await executeTask(packet);
    assert.strictEqual(response.action, "write");
    assert.ok(response.payload.message.startsWith("Summary: Vadjanix is an auton..."));
  });

  // --- Test 2: Calculate Data ---
  await test("Task: calculate_data", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user",
      to: "vadjanix://brain",
      action: "call",
      payload: {
        message: "Calculate the sum.",
        details: {
          task_name: "calculate_data",
          parameters: { numbers: [1, 2, 3, 4, 5] }
        }
      },
      reasoning: "Requesting calculation."
    };

    const response = await executeTask(packet);
    assert.strictEqual(response.action, "write");
    assert.strictEqual(response.payload.message, "15");
  });

  // --- Test 3: Unauthorized Task ---
  await test("Unauthorized Task", async () => {
    const packet: IntentPacket = {
      from: "vadjanix://user",
      to: "vadjanix://brain",
      action: "call",
      payload: {
        message: "Run secret script.",
        details: {
          task_name: "run_script",
          parameters: { code: "process.exit(1)" }
        }
      },
      reasoning: "Attempting unauthorized execution."
    };

    const response = await executeTask(packet);
    assert.strictEqual(response.action, "refuse");
    assert.strictEqual(response.payload.message, "Task not recognized or unauthorized.");
  });

  // --- Test 4: Missing Task Name ---
  await test("Missing Task Name", async () => {
      // Bypassing TS check for testing
    const packet: any = {
      from: "vadjanix://user",
      to: "vadjanix://brain",
      action: "call",
      payload: {
        message: "Do something.",
        details: {}
      },
      reasoning: "Invalid call."
    };

    const response = await executeTask(packet);
    assert.strictEqual(response.action, "refuse");
    assert.strictEqual(response.payload.message, "Task not recognized or unauthorized.");
  });

  console.log("\n-------------------------------------------");
  console.log(`Task Runner Tests: ${passedTests}/${totalTests} Passed`);
  console.log("-------------------------------------------");

  if (passedTests < totalTests) process.exit(1);
}

runTests();
