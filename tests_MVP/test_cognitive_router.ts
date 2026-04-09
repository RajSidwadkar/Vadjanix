import { processUserInput } from '../src/router/index.js';
import Database from 'better-sqlite3';
import fs from 'fs';

// Mock embedding helper to match brain/router.ts
function getMockEmbedding(text: string): number[] {
  const embedding = new Array(128).fill(0);
  for (let i = 0; i < text.length; i++) {
    embedding[i % 128] += text.charCodeAt(i) / 255;
  }
  const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map(v => v / (mag || 1));
}

async function runTests() {
  console.log("🚀 STARTING COGNITIVE ROUTER TESTS\n");

  // 0. Seed Database
  const db = new Database('memory/vadjanix.db');
  db.exec("DELETE FROM episodes");
  db.exec("DELETE FROM causal_edges");

  const episodicInput = "calculate trajectory";
  const episodicOutput = "Executing orbital maneuver 7-Alpha.";
  const embedding = new Float32Array(getMockEmbedding(episodicInput));
  
  db.prepare('INSERT INTO episodes (input, output, embedding) VALUES (?, ?, ?)').run(
    episodicInput,
    episodicOutput,
    Buffer.from(embedding.buffer)
  );

  db.prepare('INSERT INTO causal_edges (cause, effect, confidence) VALUES (?, ?, ?)').run(
    "system overload",
    "emergency shutdown",
    0.95
  );

  // 1. Test Layer 1: Reflexes
  console.log("TEST 1: Layer 1 (Reflexes) - 'status'");
  await processUserInput("What is your current status?");

  // 2. Test Layer 2: Episodic Replay
  console.log("TEST 2: Layer 2 (Episodic) - 'calculate trajectory'");
  await processUserInput("I need to calculate trajectory for the next burn.");

  // 3. Test Layer 3: Causal Inference
  console.log("TEST 3: Layer 3 (Causal) - 'system overload'");
  await processUserInput("Warning: detected system overload in core 4.");

  // 4. Test Layer 4: LLM Fallback
  console.log("TEST 4: Layer 4 (LLM Fallback) - Unknown query");
  if (process.env.GEMINI_API_KEY) {
    await processUserInput("Who is Raj Sidwadkar?");
  } else {
    console.log("Skipping LLM test (No API Key).");
  }

  console.log("\n✅ TESTS COMPLETE");
}

runTests().catch(console.error);
