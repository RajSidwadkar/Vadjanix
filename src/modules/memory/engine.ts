import { embed, cosineSimilarity } from '../../embedding/embed_client.js';

export class CognitiveEngine {
  public async init(): Promise<void> {
    // No-op for now as embed_client handles its own init/fallbacks
  }

  public async getEmbedding(text: string): Promise<Float32Array> {
    const embedding = await embed(text);
    return new Float32Array(embedding);
  }

  public cosineSimilarity(a: Float32Array, b: Float32Array): number {
    return cosineSimilarity(Array.from(a), Array.from(b));
  }
}
