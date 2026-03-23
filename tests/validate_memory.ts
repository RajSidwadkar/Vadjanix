import fs from 'fs/promises';
import path from 'path';
import assert from 'assert';
import { generateIntent, loadRecentMemory, logInteraction } from '../src/brain/engine.js';

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m"
};

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const BACKUP_DIR = path.join(process.cwd(), 'memory_backup');

async function setup() {
    console.log(`${colors.cyan}--- Setting up test environment ---${colors.reset}`);
    try {
        // Backup real memory
        await fs.rename(MEMORY_DIR, BACKUP_DIR);
    } catch (e: any) {
        if (e.code !== 'ENOENT') console.error("Setup Warning:", e);
    }
}

async function teardown() {
    console.log(`${colors.cyan}--- Tearing down test environment ---${colors.reset}`);
    try {
        // Delete test memory
        await fs.rm(MEMORY_DIR, { recursive: true, force: true });
        // Restore real memory
        await fs.rename(BACKUP_DIR, MEMORY_DIR);
    } catch (e: any) {
        if (e.code !== 'ENOENT') console.error("Teardown Warning:", e);
    }
}

async function runTest(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`${colors.green}PASS: ${name}${colors.reset}`);
    } catch (e: any) {
        console.log(`${colors.red}FAIL: ${name}${colors.reset}`);
        console.error(e);
        // We still need to teardown on failure
        await teardown();
        process.exit(1);
    }
}

async function main() {
    await setup();

    // Test 1: First Contact (ENOENT Handling)
    await runTest("First Contact (ENOENT Handling)", async () => {
        const memory = await loadRecentMemory();
        assert.strictEqual(memory, "No prior interactions.");
    });

    // Test 2: Token Firewall (Truncation)
    await runTest("Token Firewall (Truncation)", async () => {
        const massiveString = "X".repeat(10000) + "END_OF_FILE";
        await fs.mkdir(MEMORY_DIR, { recursive: true });
        await fs.writeFile(path.join(MEMORY_DIR, 'context_log.md'), massiveString);

        const memory = await loadRecentMemory();
        assert(memory.includes("END_OF_FILE"));
        assert(memory.length <= 2500); 
    });

    // Test 3: Write-Back (Disk I/O)
    await runTest("Write-Back (Disk I/O)", async () => {
        const prompt = "Test Write-Back Prompt";
        const fakePacket = {
            from: 'vadjanix://brain',
            to: 'user',
            action: 'propose' as const,
            payload: { message: "Test Response", details: {} },
            reasoning: "Test Reasoning"
        };
        
        await logInteraction(prompt, fakePacket);
        
        const logContent = await fs.readFile(path.join(MEMORY_DIR, 'context_log.md'), 'utf-8');
        assert(logContent.includes(prompt));
        assert(logContent.includes("Test Response"));
        assert(logContent.includes("## ["));
    });

    // Test 4: Stateful Callback (Context Awareness)
    await runTest("Stateful Callback (Context Awareness)", async () => {
        const history = "\n## [2026-03-23T10:00:00Z]\n**Them:** My name is John.\n**Vadjanix (propose):** Hello John.\n";
        await fs.appendFile(path.join(MEMORY_DIR, 'context_log.md'), history);

        const response = await generateIntent("What is my name?");
        if (!response.payload.message.toLowerCase().includes("john")) {
            console.log(`${colors.yellow}Diagnostic - Actual Message: ${response.payload.message}${colors.reset}`);
        }
        assert(response.payload.message.toLowerCase().includes("john"));
    });

    // Test 5: Negotiation Memory (Dynamic Refusal)
    await runTest("Negotiation Memory (Dynamic Refusal)", async () => {
        const history = "\n## [2026-03-23T11:00:00Z]\n**Them:** I offer $50.\n**Vadjanix (refuse):** My minimum rate is $250/hr.\n";
        await fs.appendFile(path.join(MEMORY_DIR, 'context_log.md'), history);

        const response = await generateIntent("Okay, I will pay the $250 you asked for.");
        // Should no longer refuse
        assert.notStrictEqual(response.action, "refuse");
    });

    await teardown();
    console.log(`\n${colors.yellow}✨ ALL MEMORY TESTS PASSED ✨${colors.reset}`);
}

main().catch(async (e) => {
    console.error(e);
    await teardown();
    process.exit(1);
});
