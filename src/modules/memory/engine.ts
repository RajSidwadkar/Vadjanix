import { pipeline } from '@xenova/transformers';

export class CognitiveEngine {
  private extractor: any = null;

  public async init(): Promise<void> {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
  }

  public async getEmbedding(text: string): Promise<Float32Array> {
    await this.init();
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return output.data as Float32Array;
  }

  public cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
