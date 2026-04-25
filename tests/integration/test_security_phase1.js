import assert from 'node:assert';
import { SecureVault } from '../../src/modules/security/vault.js';
import { AuditChain } from '../../src/modules/security/audit_chain.js';
import { MemoryWriteGate } from '../../src/modules/security/memory_write_gate.js';
import { NetworkGuard } from '../../src/modules/security/network_guard.js';
import { RateLimiter } from '../../src/brain/rate_limiter.js';
import { verifyEvent } from 'nostr-tools';
import fs from 'node:fs/promises';
import path from 'node:path';
const COLORS = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};
async function runTest(name, fn) {
    try {
        await fn();
        console.log(`${COLORS.green}[PASS]${COLORS.reset} ${name}`);
        return true;
    }
    catch (error) {
        console.log(`${COLORS.red}[FAIL]${COLORS.reset} ${name} | Error: ${error.message}`);
        return false;
    }
}
async function testSuite() {
    console.log(`\n${COLORS.cyan}=== VADJANIX SECURITY PHASE 1 AUDIT ===${COLORS.reset}\n`);
    let score = 0;
    if (await runTest("CVE-1 (Vault): AES-256-GCM Integrity", async () => {
        const data = "SovereignAGI-2026";
        const encrypted = SecureVault.encrypt(data);
        const decrypted = SecureVault.decrypt(encrypted);
        assert.strictEqual(decrypted, data);
    }))
        score++;
    if (await runTest("CVE-2 (Audit Chain): SHA-256 Hash-Chaining", async () => {
        const logPath = path.join(process.cwd(), 'swarm_log.md');
        const initialContent = await fs.readFile(logPath, 'utf-8').catch(() => "");
        await AuditChain.appendToAuditChain("SECURITY_TEST_EVENT");
        const updatedContent = await fs.readFile(logPath, 'utf-8');
        assert.ok(updatedContent.length > initialContent.length);
        assert.ok(updatedContent.includes("HASH: "));
    }))
        score++;
    if (await runTest("CVE-3 (Prompt Injection): System Isolation", async () => {
        const agentPath = path.join(process.cwd(), 'src', 'core', 'agent.ts');
        const content = await fs.readFile(agentPath, 'utf-8');
        assert.ok(content.includes('const systemPrompt = `'));
        assert.ok(content.includes('const context = `[CONSTITUTION]'));
    }))
        score++;
    if (await runTest("CVE-4 (Memory Poisoning): Write Gatekeeping", async () => {
        const lowTrust = await MemoryWriteGate.gateMemoryWrite("poison", "source", 0.2);
        const highTrust = await MemoryWriteGate.gateMemoryWrite("valid", "source", 0.9);
        assert.strictEqual(lowTrust, false);
        assert.strictEqual(highTrust, true);
    }))
        score++;
    if (await runTest("CVE-5 (SSRF): Infrastructure Network Guard", async () => {
        const cloudMetadata = await NetworkGuard.validateUrl("http://169.254.169.254/latest/meta-data");
        const localhost = await NetworkGuard.validateUrl("http://127.0.0.1:3000");
        const privateIP = await NetworkGuard.validateUrl("http://10.0.0.1");
        const publicIP = await NetworkGuard.validateUrl("http://1.1.1.1");
        assert.strictEqual(cloudMetadata, false);
        assert.strictEqual(localhost, false);
        assert.strictEqual(privateIP, false);
        assert.strictEqual(publicIP, true);
    }))
        score++;
    if (await runTest("CVE-6 (Spoofing): Nostr Signature Enforcement", async () => {
        const mockEvent = {
            id: "abc",
            pubkey: "0000000000000000000000000000000000000000000000000000000000000000",
            created_at: Math.floor(Date.now() / 1000),
            kind: 29999,
            tags: [],
            content: "{}",
            sig: "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        };
        assert.strictEqual(verifyEvent(mockEvent), false);
    }))
        score++;
    if (await runTest("CVE-7 (DoS): Session Tool Rate Limiter", async () => {
        const limiter = new RateLimiter(20);
        const sessionId = "audit-session-" + Date.now();
        for (let i = 0; i < 20; i++) {
            assert.strictEqual(limiter.checkRateLimit(sessionId), true);
        }
        assert.strictEqual(limiter.checkRateLimit(sessionId), false);
    }))
        score++;
    console.log(`\n${COLORS.cyan}SYSTEM ROBUSTNESS SCORE: ${score}/7 CVE CLASSES CLOSED.${COLORS.reset}\n`);
    if (score === 7) {
        process.exit(0);
    }
    else {
        process.exit(1);
    }
}
testSuite().catch(err => {
    console.error(err);
    process.exit(1);
});
