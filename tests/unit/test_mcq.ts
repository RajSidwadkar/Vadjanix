import assert from 'node:assert';
import { ActionClassifier } from '../../src/core/autonomy.js';
import { formatWhatsAppMCQ } from '../../src/infrastructure/adapters/whatsapp_formatter.js';
import { MCQPacket } from '../../src/core/mcq_schema.js';

async function runTests() {
  console.log('--- STARTING MCQ ENGINE UNIT TESTS ---');

  try {
    const classifier = new ActionClassifier();
    
    // Test 1: Autonomy Level L1 (High Confidence, Low Risk)
    const level1 = classifier.classifyAction('low-risk-action', 0.95, 0.9, true, 'Low');
    assert.strictEqual(level1, 'L1');
    console.log('[PASS] Test 1: L1 Classification (Autonomous)');

    // Test 2: Autonomy Level L4 (High Risk, Irreversible)
    const level4 = classifier.classifyAction('critical-action', 0.95, 0.9, false, 'High');
    assert.strictEqual(level4, 'L4');
    console.log('[PASS] Test 2: L4 Classification (Manual Only)');

    // Test 3: MCQ WhatsApp Formatting
    const mockPacket: MCQPacket = {
      level: 'L3',
      confidence: 0.65,
      reversible: true,
      risk: 'Medium',
      question: 'Should I consolidate the local memory capsule for session X-99?',
      options: {
        A: 'Proceed with consolidation',
        B: 'Defer until next heartbeat',
        C: 'Discard episodic fragments'
      },
      auto_action: 'B',
      timeout_mins: 15,
      semantic_diff: 'This will merge 12 unverified memory fragments into long-term storage.'
    };

    const formatted = formatWhatsAppMCQ(mockPacket);
    assert.ok(formatted.includes('[L3 Decision Required]'));
    assert.ok(formatted.includes('Confidence: 65%'));
    assert.ok(formatted.includes('A) Proceed with consolidation'));
    assert.ok(formatted.includes('Auto-proceeds with B in 15min'));
    console.log('[PASS] Test 3: WhatsApp MCQ Formatting');

    console.log('\nMCQ ENGINE STATUS: 100% RELIABILITY.');
    process.exit(0);
  } catch (error) {
    console.error('\n[FAIL] MCQ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

runTests();
