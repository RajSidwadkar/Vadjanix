import { VadjanixMemory, MemoryStore, CognitiveEngine } from "./memory/memory_system.ts";

async function run() {
  const store = new MemoryStore("memory/vadjanix.db");
  const cognitive = new CognitiveEngine();
  const mem = new VadjanixMemory(store, cognitive);
  const result = await mem.retrieve("test");
  console.log("Retrieved episodes:", result.episodic.length);
  process.exit(0);
}

run().catch(console.error);
