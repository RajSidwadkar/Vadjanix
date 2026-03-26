import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { calculateReputation } from '../src/memory/reputation.js';

async function runTests() {
  console.log("🚀 Starting Reputation Engine Tests...");

  const memoryDir = path.join(process.cwd(), 'memory');
  const dealsPath = path.join(memoryDir, 'deals.md');
  const backupPath = path.join(memoryDir, 'deals.md.backup');

  // Setup memory dir if it doesn't exist
  await fs.mkdir(memoryDir, { recursive: true });

  // Backup existing deals if any
  let hadBackup = false;
  try {
    await fs.rename(dealsPath, backupPath);
    hadBackup = true;
  } catch (e) {}

  try {
    // Test 1: Missing file
    console.log("\n[TEST 1] Reputation with missing file");
    const score1 = await calculateReputation("some_pubkey");
    assert.strictEqual(score1, 50, "Should return 50 if file is missing");
    console.log("[PASS] Correctly returned 50 for missing file.");

    // Test 2: Empty file
    console.log("\n[TEST 2] Reputation with empty file");
    await fs.writeFile(dealsPath, "");
    const score2 = await calculateReputation("some_pubkey");
    assert.strictEqual(score2, 50, "Should return 50 if file is empty");
    console.log("[PASS] Correctly returned 50 for empty file.");

    // Test 3: Standard Calculation
    console.log("\n[TEST 3] Reputation calculation with mixed results");
    const testDeals = [
      JSON.stringify({ counterparty: "alice", status: "success" }),
      JSON.stringify({ counterparty: "alice", status: "success" }),
      JSON.stringify({ counterparty: "alice", status: "failed" }),
      JSON.stringify({ counterparty: "bob", status: "success" }),
      JSON.stringify({ counterparty: "bob", status: "failed" }),
      "malformed_line",
      JSON.stringify({ counterparty: "charlie", status: "failed" }),
    ].join('\n');
    
    await fs.writeFile(dealsPath, testDeals);
    
    const aliceScore = await calculateReputation("alice");
    assert.strictEqual(Math.round(aliceScore), 67, "Alice score should be approx 67%");
    
    const bobScore = await calculateReputation("bob");
    assert.strictEqual(bobScore, 50, "Bob score should be 50%");
    
    const charlieScore = await calculateReputation("charlie");
    assert.strictEqual(charlieScore, 0, "Charlie score should be 0%");

    const unknownScore = await calculateReputation("unknown");
    assert.strictEqual(unknownScore, 50, "Unknown counterparty score should be neutral 50%");

    console.log("[PASS] Reputation math verified successfully.");

  } catch (error: any) {
    console.error(`\n[FAIL] Test Suite Crashed: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    console.log("\nCleaning up test environment...");
    try {
      await fs.unlink(dealsPath);
    } catch (e) {}
    if (hadBackup) {
      try {
        await fs.rename(backupPath, dealsPath);
      } catch (e) {}
    }
    console.log("DONE.");
  }
}

runTests();
