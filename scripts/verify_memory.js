import { VadjanixMemory } from '../src/modules/memory/system.js';
import { MemoryStore } from '../src/modules/memory/store.js';
import { CognitiveEngine } from '../src/modules/memory/engine.js';

async function verify() {
  const store = new MemoryStore('memory/vadjanix.db');
  const cognitive = new CognitiveEngine();
  const memory = new VadjanixMemory(store, cognitive);

  console.log("Retrieving 'test' from memory...");
  const result = await memory.retrieve("test");
  console.log("Result:", JSON.stringify(result, (key, value) => key === 'embedding' ? '<blob>' : value, 2));
  
  memory.close();
}

verify().catch(console.error);
