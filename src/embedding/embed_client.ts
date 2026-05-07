/**
 * Core Routing Types and Embedding Client
 */

export interface RouteResult {
  action: string;
  source: 'reflex' | 'episodic' | 'causal' | 'llm_required';
  confidence: number;
  llmUsed: boolean;
  context?: any;
}

/**
 * Mockable embed function.
 * Simulates returning a 384-dimension vector (common for small models).
 * Preparing for a swappable ONNX/HTTP backend.
 */
export async function embed(text: string): Promise<number[]> {
  // Simulate network or computation delay
  await new Promise(resolve => setTimeout(resolve, 5));
  
  // Return a deterministic mock vector based on the string length and first char
  // This helps in basic similarity testing if needed
  const vector = new Array(384).fill(0).map((_, i) => {
    return Math.sin(text.length + i + (text.charCodeAt(0) || 0));
  });
  
  return vector;
}

/**
 * Helper to calculate cosine similarity between two vectors
 */
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
  const similarity = dotProduct / (mA * mB);
  return similarity;
}
