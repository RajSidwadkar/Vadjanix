import { pipeline } from '@xenova/transformers';

export interface RouteResult {
  action: string | null;
  source: 'reflex' | 'episodic' | 'causal' | 'llm_required';
  confidence: number;
  llmUsed: boolean;
  context?: any;
}

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    try {
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.warn('Failed to load @xenova/transformers, will try fallbacks.', error);
    }
  }
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  // Try @xenova/transformers first
  const localExtractor = await getExtractor();
  if (localExtractor) {
    try {
      const output = await localExtractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.warn('Xenova embedding failed, trying fallback 1.', error);
    }
  }

  // Fallback 1: HTTP POST to localhost:5000/embed
  try {
    const response = await fetch('http://localhost:5000/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (response.ok) {
      const data = await response.json() as { embedding: number[] };
      return data.embedding;
    }
  } catch (error) {
    console.warn('Fallback 1 (localhost:5000) failed, trying fallback 2.', error);
  }

  // Fallback 2: Ollama /api/embeddings with nomic-embed-text
  try {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    if (response.ok) {
      const data = await response.json() as { embedding: number[] };
      return data.embedding;
    }
  } catch (error) {
    console.error('All embedding fallbacks failed.', error);
  }

  throw new Error('No embedding provider available');
}

export function cosineSimilarity(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mA += v1[i] * v1[i];
    mB += v2[i] * v2[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
}
