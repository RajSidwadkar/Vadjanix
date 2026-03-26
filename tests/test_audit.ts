import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logDecision } from '../src/memory/audit.js';
import { evaluateProposal } from '../src/brain/negotiator.js';

async function runTests() {
  console.log("🚀 Starting Audit Log Tests...");

  const auditPath = path.join(process.cwd(), 'audit_log.md');
  const backupPath = path.join(process.cwd(), 'audit_log.md.backup');

  // Backup existing log
  let hadBackup = false;
  try {
    await fs.rename(auditPath, backupPath);
    hadBackup = true;
  } catch (e) {}

  try {
    // Test 1: Direct Log
    console.log("\n[TEST 1] Direct logDecision call");
    await logDecision('test_action', 'test_context', 'test_rule', 'test_decision');
    
    let content = await fs.readFile(auditPath, 'utf-8');
    assert.ok(content.includes('ACTION: test_action'), "Log should contain action");
    assert.ok(content.includes('CONTEXT: test_context'), "Log should contain context");
    assert.ok(content.includes('RULE: test_rule'), "Log should contain rule");
    assert.ok(content.includes('DECISION: test_decision'), "Log should contain decision");
    assert.ok(content.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/), "Log should contain timestamp");
    console.log("[PASS] Direct log verified.");

    // Test 2: Negotiator Integration
    console.log("\n[TEST 2] Negotiator log integration");
    await evaluateProposal('compromise', 'seller', 250, 300, 10);
    
    content = await fs.readFile(auditPath, 'utf-8');
    assert.ok(content.includes('Counter-offer of $290'), "Log should contain the negotiator decision");
    assert.ok(content.includes('RULE: Monotonic Bidding Rule'), "Log should contain the rule applied by negotiator");
    console.log("[PASS] Negotiator integration verified.");

  } catch (error: any) {
    console.error(`\n[FAIL] Test Suite Crashed: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    console.log("\nCleaning up test environment...");
    try {
      await fs.unlink(auditPath);
    } catch (e) {}
    if (hadBackup) {
      try {
        await fs.rename(backupPath, auditPath);
      } catch (e) {}
    }
    console.log("DONE.");
  }
}

runTests();
