import assert from 'node:assert';
import { routePacket } from '../src/router/index.js';
import { signPacket } from '../src/voice/crypto.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { IntentPacket } from '../src/router/schema.js';

async function main() {
    console.log("🚀 Starting Comprehensive Router Integration Tests...");
    let failureCount = 0;

    // Generate throwaway keys for crypto testing
    const sk = Buffer.from(generateSecretKey()).toString('hex');
    const pk = getPublicKey(Buffer.from(sk, 'hex'));
    process.env.VADJANIX_PUBKEY = pk;

    async function runTest(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`[PASS] ${name}`);
        } catch (e: any) {
            console.error(`[FAIL] ${name}: ${e.message}`);
            failureCount++;
        }
    }

    // Test 1: The 400 Bad Request (Zod Shield)
    await runTest("The 400 Bad Request (Zod Shield)", async () => {
        const result = await routePacket({});
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, 400);
    });

    // Test 2: The 200 OK (Standard Internal Route)
    await runTest("The 200 OK (Standard Internal Route)", async () => {
        const packet: IntentPacket = {
            from: "vadjanix://brain",
            to: "file://local/test.txt",
            action: "read",
            payload: { message: "reading test file" },
            reasoning: "Internal test"
        };
        const result = await routePacket(packet);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.status, 200);
    });

    // Test 3: The 401 Unauthorized (Missing Nostr Auth)
    await runTest("The 401 Unauthorized (Missing Nostr Auth)", async () => {
        const packet: any = {
            from: "vadjanix://external-agent",
            to: "vadjanix://network",
            action: "read",
            payload: { message: "Hello" },
            reasoning: "Test without auth"
        };
        const result = await routePacket(packet);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, 401);
        assert.ok(result.error?.includes("Missing 'auth' field"));
    });

    // Test 4: The 401 Unauthorized (Forged Nostr Signature)
    await runTest("The 401 Unauthorized (Forged Nostr Signature)", async () => {
        const packet: IntentPacket = {
            from: "vadjanix://external-agent",
            to: "vadjanix://network",
            action: "read",
            payload: { message: "Hello" },
            reasoning: "Test with forged auth",
            auth: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
        };
        const result = await routePacket(packet);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, 401);
        assert.ok(result.error?.includes("Invalid Nostr signature"));
    });

    // Test 5: The 200 OK (Cryptographically Verified)
    await runTest("The 200 OK (Cryptographically Verified)", async () => {
        const packet: IntentPacket = {
            from: "vadjanix://external-agent",
            to: "vadjanix://network",
            action: "read",
            payload: { message: "Authenticated call" },
            reasoning: "Signed test"
        };
        const signedPacket = await signPacket(packet, sk);
        
        // Debug: Log the signed packet
        // console.log("DEBUG: Signed Packet:", JSON.stringify(signedPacket, null, 2));
        
        const result = await routePacket(signedPacket);
        if (!result.success) {
            console.error("DEBUG: Route failed with error:", result.error);
        }
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.status, 200);
    });

    // Test 6: The 404 Not Found (Unknown Protocol)
    await runTest("The 404 Not Found (Unknown Protocol)", async () => {
        const packet: IntentPacket = {
            from: "vadjanix://brain",
            to: "ghost://unknown/path",
            action: "read",
            payload: { message: "Unknown protocol" },
            reasoning: "Ghost test"
        };
        const result = await routePacket(packet);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, 404);
        assert.ok(result.error?.includes("Unsupported protocol prefix"));
    });

    if (failureCount > 0) {
        console.error(`\n❌ Integration suite failed with ${failureCount} errors.`);
        process.exit(1);
    } else {
        console.log("\n✅ All Router Integration Tests Passed!");
    }
}

main().catch(e => {
    console.error("Test Runner Catastrophic Failure:", e);
    process.exit(1);
});
