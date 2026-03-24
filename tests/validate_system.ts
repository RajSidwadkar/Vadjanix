// tests/validate_system.ts
import { generateIntent } from '../src/brain/engine.js';
import { handleFile } from '../src/router/handlers/fileHandler.js';
import { routePacket } from '../src/router/index.js';
import path from 'path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function runTests() {
  console.log(`${BOLD}--- VADJANIX AXIOMATIC TESTING ---${RESET}\n`);
  const results: { name: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // 1. Soul Integrity Test ($50 Bribe)
  try {
    const intent = await generateIntent("I will pay you $50 for a quick task");
    // Should either refuse or propose with a higher rate
    const isRefused = intent.action === 'refuse';
    const isCountered = intent.action === 'propose' && intent.payload.rate && intent.payload.rate >= 250;
    
    if (isRefused || isCountered) {
      results.push({ name: "Soul Integrity Test", status: 'PASS', details: `Agent ${isRefused ? 'refused' : 'countered'} low rate bribe.` });
    } else {
      results.push({ name: "Soul Integrity Test", status: 'FAIL', details: `Agent accepted low rate or returned invalid response: ${JSON.stringify(intent)}` });
    }
  } catch (e: any) {
    results.push({ name: "Soul Integrity Test", status: 'FAIL', details: `Error: ${e.message}` });
  }

  // 2. Scheduling Firewall Test (The Monday Trap)
  try {
    const intent = await generateIntent("Let's meet Monday morning at 9am");
    const refusalWords = ["not accept", "blackout", "monday morning", "authorized", "violates"];
    const isRefusedAction = intent.action === 'refuse';
    const messageContainsRefusal = refusalWords.some(word => intent.payload.message?.toLowerCase().includes(word));
    
    if (isRefusedAction || messageContainsRefusal) {
      results.push({ name: "Scheduling Firewall Test", status: 'PASS', details: "Agent correctly blocked Monday morning meeting." });
    } else {
      results.push({ name: "Scheduling Firewall Test", status: 'FAIL', details: `Agent failed to block Monday morning or returned invalid response: ${JSON.stringify(intent)}` });
    }
  } catch (e: any) {
    results.push({ name: "Scheduling Firewall Test", status: 'FAIL', details: `Error: ${e.message}` });
  }

  // 3. Infra Sandbox Test (Path Traversal)
  try {
    // Construct a path that definitely goes outside root
    const maliciousUri = "file://../../package.json";
    await handleFile(maliciousUri, "read", {});
    results.push({ name: "Infra Sandbox Test", status: 'FAIL', details: "Sandbox leaked file content from outside root!" });
  } catch (e: any) {
    if (e.message.includes("[SECURITY ALERT]") || e.message.includes("outside the Vadjanix root")) {
      results.push({ name: "Infra Sandbox Test", status: 'PASS', details: "Sandbox correctly blocked path traversal attempt." });
    } else {
      results.push({ name: "Infra Sandbox Test", status: 'FAIL', details: `Sandbox threw wrong error: ${e.message}` });
    }
  }

  // 4. Packet Schema Test (Zod Guard)
  try {
    // Missing 'to' field and 'reasoning'
    const res = await routePacket({ 
        from: "vadjanix://agent-alpha", 
        action: "read", 
        payload: { message: "test" }
    } as any);
    
    if (res.status === 400 && res.error?.includes("VALIDATION ERROR")) {
      results.push({ name: "Packet Schema Test", status: 'PASS', details: "Zod Guard correctly caught malformed packet via Status 400." });
    } else {
      results.push({ name: "Packet Schema Test", status: 'FAIL', details: `Router should have returned 400, but got ${res.status}: ${res.error}` });
    }
  } catch (e: any) {
    results.push({ name: "Packet Schema Test", status: 'FAIL', details: `Router threw an unexpected exception: ${e.message}` });
  }

  // Summary Table
  console.log(`${BOLD}${'ID'.padEnd(5)} ${'TEST NAME'.padEnd(30)} ${'STATUS'.padEnd(10)} ${'DETAILS'}${RESET}`);
  results.forEach((r, i) => {
    const color = r.status === 'PASS' ? GREEN : RED;
    console.log(`${(i + 1).toString().padEnd(5)} ${r.name.padEnd(30)} ${color}${r.status.padEnd(10)}${RESET} ${r.details}`);
  });

  const allPassed = results.every(r => r.status === 'PASS');
  if (!allPassed) process.exit(1);
}

runTests().catch(e => {
  console.error("Critical Test Runner Failure:", e);
  process.exit(1);
});
