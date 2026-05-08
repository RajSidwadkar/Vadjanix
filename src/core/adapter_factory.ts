import { LLMAdapter } from './llm_adapter.js';
import { OllamaAdapter } from '../adapters/ollama_adapter.js';
import { GeminiAdapter } from '../adapters/gemini_adapter.js';
import { ClaudeAdapter } from '../adapters/claude_adapter.js';
import fs from 'node:fs';

export function createAdapter(config?: { provider: string }): LLMAdapter {
  let provider = config?.provider;

  if (!provider) {
    try {
      if (fs.existsSync('config.json')) {
        const fileConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        provider = fileConfig.provider;
      }
    } catch {
      // Fallback to default
    }
  }

  switch (provider) {
    case 'gemini':
      return new GeminiAdapter();
    case 'claude':
      return new ClaudeAdapter();
    case 'ollama':
    default:
      return new OllamaAdapter();
  }
}
