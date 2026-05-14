
import { OllamaAdapter } from './src/infrastructure/adapters/OllamaAdapter.js';
import { GeminiAdapter } from './src/infrastructure/adapters/GeminiAdapter.js';

async function test() {
  const ollama = new OllamaAdapter('llama3:latest');
  console.log('Testing Ollama availability...');
  const ollamaAvailable = await ollama.isAvailable();
  console.log('Ollama available:', ollamaAvailable);

  const gemini = new GeminiAdapter();
  console.log('Testing Gemini availability...');
  const geminiAvailable = await gemini.isAvailable();
  console.log('Gemini available:', geminiAvailable);
}

test().catch(console.error);
