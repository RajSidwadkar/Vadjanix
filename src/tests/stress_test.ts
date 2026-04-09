import { CognitiveRouter } from '../brain/router.js';
import Database from 'better-sqlite3';

// Mock embedding helper to match brain/router.ts
function getMockEmbedding(text: string): number[] {
  const embedding = new Array(128).fill(0);
  for (let i = 0; i < text.length; i++) {
    embedding[i % 128] += text.charCodeAt(i) / 255;
  }
  const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map(v => v / (mag || 1));
}

async function runStressTest() {
    const router = new CognitiveRouter();
    const db = new Database('memory/vadjanix.db');

    // Seed Data
    console.log("Seeding stress test data...");
    db.exec("DELETE FROM episodes");
    db.exec("DELETE FROM causal_edges");

    const episodicInput = "save current state";
    const embedding = new Float32Array(getMockEmbedding(episodicInput));
    db.prepare('INSERT INTO episodes (input, output, embedding) VALUES (?, ?, ?)').run(
        episodicInput,
        "State saved to episodic memory.",
        Buffer.from(embedding.buffer)
    );

    db.prepare('INSERT INTO causal_edges (cause, effect, confidence) VALUES (?, ?, ?)').run(
        "A",
        "B",
        0.95
    );
    
    const tests = [
        { input: "1+1", expectedSource: "reflex" }, // Layer 1 (Math)
        { input: "status", expectedSource: "reflex" }, // Layer 1 (Principles)
        { input: "save current state", expectedSource: "episodic_replay" }, // Layer 2
        { input: "Explain the causal link between A and B", expectedSource: "causal" } // Layer 3
    ];

    for (const test of tests) {
        const result = await router.processUserInput(test.input);
        if (result.source !== test.expectedSource) {
            console.error(`❌ Fail: Expected ${test.expectedSource} for "${test.input}", got ${result.source}`);
            process.exit(1);
        }
        console.log(`✅ [${result.source.toUpperCase()}] - ${test.input}`);
    }

    // Layer 4 Breach Test
    console.log("TEST 5: Layer 4 (Sovereignty Breach) - Missing API Key");
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    try {
        await router.processUserInput("What is the meaning of life?");
        console.error("❌ Fail: Layer 4 did not throw SOVEREIGNTY BREACH with missing API key.");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes("SOVEREIGNTY BREACH")) {
            console.log("✅ [SOVEREIGNTY BREACH] - Correctly blocked Layer 4.");
        } else {
            console.error(`❌ Fail: Got unexpected error: ${e.message}`);
            process.exit(1);
        }
    } finally {
        process.env.GEMINI_API_KEY = originalKey;
    }

    console.log("\n🚀 STRESS TEST PASSED - Cognitive Router is leak-proof and sovereign.");
}

runStressTest().catch(e => {
    console.error(e);
    process.exit(1);
});
