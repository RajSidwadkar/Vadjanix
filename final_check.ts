import { VadjanixMemory, MemoryStore, CognitiveEngine } from "./memory/memory_system.ts";

async function run() {
  const mem = new VadjanixMemory();
  const result = await mem.retrieve("test");
  console.log("Retrieved episodes with default constructor:", result.episodic.length);
  mem.close();
  process.exit(0);
}

run().catch(console.error);
