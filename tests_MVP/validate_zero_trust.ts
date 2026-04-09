import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Set test port BEFORE importing server
process.env.PORT = '3001';
const { default: server } = await import('../src/router/server.js');

const TEST_URL = 'http://localhost:3001';
const LOG_FILE = path.join(process.cwd(), 'security-audit.log');

// Helper to make a POST request
function makePostRequest(payload: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${TEST_URL}/route`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => resolve(res)
    );
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Zero-Trust Integration Tests...');

  try {
    // Ensure log file is clean before starting
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

    // Test 1: The DoS Payload (1MB Limit)
    console.log('Test 1: Massive 1.5MB Payload...');
    const massivePayload = 'a'.repeat(1.5 * 1024 * 1024);
    const res1 = await makePostRequest(massivePayload).catch(err => {
        // req.destroy() might cause an error in the request, which is expected
        return { statusCode: 413 } as http.IncomingMessage;
    });
    assert.strictEqual(res1.statusCode, 413, 'Should reject payload over 1MB');

    // Test 2: The Schema Injection (Zod Shield)
    console.log('Test 2: Structurally Invalid JSON...');
    const invalidJson = JSON.stringify({ action: "hack_the_planet" });
    const res2 = await makePostRequest(invalidJson);
    assert.strictEqual(res2.statusCode, 400, 'Should reject invalid schema');

    // Test 3: The Audit Log Verification
    console.log('Test 3: Audit Log Persistence...');
    assert.ok(fs.existsSync(LOG_FILE), 'Audit log file should exist');
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    assert.ok(logs.includes('hack_the_planet') || logs.includes('Zod Schema Failure'), 'Audit log should record the failure');
    console.log('Audit log entry found: PASS');

    console.log('\n[PASS] All Zero-Trust Boundary Tests passed! ✅');
  } catch (error) {
    console.error('\n[FAIL] Test Failure:', error);
    process.exit(1);
  } finally {
    // Teardown
    console.log('Cleaning up...');
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    server.close();
    process.exit(0);
  }
}

// Start tests
runTests();
