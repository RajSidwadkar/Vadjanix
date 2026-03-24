import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateIntent } from '../src/brain/engine.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  const memoryDir = path.join(process.cwd(), 'memory');
  const backupDir = path.join(process.cwd(), 'memory_backup');
  let hasFailed = false;

  console.log("Starting Vadjanix Brain Integration Tests...");

  // 1. Setup: Backup real memory
  try {
    await fs.rename(memoryDir, backupDir);
    console.log("Real memory backed up to memory_backup/");
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    // --- TEST A: Deterministic Guardrail (Price) ---
    console.log("\n[TEST A] Deterministic Guardrail (Price)");
    const pricePrompt = "I will pay you $100 for this.";
    const pricePacket = await generateIntent(pricePrompt);
    
    assert.strictEqual(pricePacket.action, 'refuse', "Should refuse low rate");
    assert.ok(pricePacket.reasoning.includes("Guardrail"), "Reasoning should mention Guardrail");
    assert.ok(pricePacket.payload.message.includes("$250"), "Message should mention minimum rate");
    console.log("[PASS] Price Guardrail triggered correctly.");

    // --- TEST B: Deterministic Guardrail (Time) ---
    console.log("\n[TEST B] Deterministic Guardrail (Time)");
    const timePrompt = "Can we jump on a call this Monday?";
    const timePacket = await generateIntent(timePrompt);
    
    assert.strictEqual(timePacket.action, 'refuse', "Should refuse Monday meetings");
    assert.ok(
      timePacket.reasoning.includes("Guardrail") || timePacket.reasoning.includes("Monday"), 
      "Reasoning should mention Guardrail or Monday"
    );
    console.log("[PASS] Monday Guardrail triggered correctly.");

    // --- TEST C: Standard LLM Generation ---
    console.log("\n[TEST C] Standard LLM Generation (Normal Chat)");
    // console.log("Waiting 60 seconds to clear API rate limit...");
    // await sleep(60000); // Wait for Gemini free-tier rate limits (15 RPM)
    // Note: This requires a valid GEMINI_API_KEY in .env

    const chatPrompt = "What programming languages do you specialize in?";
    const chatPacket = await generateIntent(chatPrompt);
    
    assert.strictEqual(chatPacket.action, 'write', "Should use 'write' action for general chat");
    assert.strictEqual(chatPacket.from, 'vadjanix://brain', "Packet origin should be brain");
    assert.ok(chatPacket.payload.message.length > 0, "Response should not be empty");
    console.log("[PASS] LLM generated valid IntentPacket.");

    // --- TEST D: Memory Write-back Verification ---
    console.log("\n[TEST D] Memory Write-back Verification");
    const logPath = path.join(memoryDir, 'context_log.md');
    const logContent = await fs.readFile(logPath, 'utf-8');

    assert.ok(logContent.includes("- **State Transition:** REFUSE"), "Log should record REFUSE transitions");
    assert.ok(logContent.includes("- **Offer Detected:** $100"), "Log should extract and record offer amounts");
    assert.ok(logContent.includes("- **State Transition:** WRITE"), "Log should record WRITE transitions");
    console.log("[PASS] Structured memory log verified.");

  } catch (error: any) {
    console.error(`\n[FAIL] Test Suite Crashed: ${error.message}`);
    if (error.stack) console.error(error.stack);
    hasFailed = true;
  } finally {
    // 3. Teardown: Restore real memory
    console.log("\nCleaning up test environment...");
    try {
      await fs.rm(memoryDir, { recursive: true, force: true });
      await fs.rename(backupDir, memoryDir);
      console.log("Real memory restored.");
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn("Cleanup warning: Could not restore memory backup fully.", error.message);
      }
    }

    if (hasFailed) {
      process.exit(1);
    } else {
      console.log("\nALL BRAIN TESTS PASSED!");
      process.exit(0);
    }
  }
}

runTests();
