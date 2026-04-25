import { MemoryStore } from './store.js';
import { CognitiveEngine } from './engine.js';
import { EpisodicRecord, SemanticRecord, ProceduralRecord } from './schema.js';
import { createAdapter } from '../../infrastructure/adapters/AdapterFactory.js';

export interface EpisodicResult extends EpisodicRecord {
  score: number;
}

export interface RetrievalResult {
  episodic: EpisodicResult[];
  semantic: SemanticRecord[];
  procedural: ProceduralRecord[];
}

export class VadjanixMemory {
  constructor(
    private store: MemoryStore,
    private cognitive: CognitiveEngine
  ) {}

  public async writeEpisode(data: Omit<EpisodicRecord, 'id' | 'timestamp' | 'consolidated' | 'embedding'>): Promise<string> {
    try {
      const embeddingArray = await this.cognitive.getEmbedding(data.raw_exchange);
      const embeddingBuffer = Buffer.from(embeddingArray.buffer, embeddingArray.byteOffset, embeddingArray.byteLength);

      const id = this.store.insertEpisodic({ ...data, embedding: embeddingBuffer });
      this.maybeConsolidate().catch((err) => {
        console.error(`[MEMORY - CONSOLIDATION ERROR] Floating promise failed:`, err.message || err);
      });
      return id.toString();
    } catch (err: any) {
      console.error(`[MEMORY - WRITE ERROR] Failed to write episode:`, err.message || err);
      throw err;
    }
  }

  public writeCausalEdge(cause: string, effect: string, probability: number, conditions: string, mechanism: string, evidence_episodes: string, verified: number = 0): void {
    try {
      this.store.insertCausal({ cause, effect, probability, conditions, mechanism, evidence_episodes, verified });
    } catch (err: any) {
      console.error(`[MEMORY - CAUSAL ERROR] Failed to write causal edge:`, err.message || err);
    }
  }

  public async retrieve(query: string, topK: number = 5): Promise<RetrievalResult> {
    try {
      const queryEmbedding = await this.cognitive.getEmbedding(query);
      const now = Date.now() / 1000;
      const allEpisodes = this.store.getAllEpisodes();
      const scoredEpisodes: EpisodicResult[] = [];

      for (const ep of allEpisodes) {
        const epEmbedding = new Float32Array(ep.embedding.buffer, ep.embedding.byteOffset, ep.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT);
        const semantic_sim = this.cognitive.cosineSimilarity(queryEmbedding, epEmbedding);
        const ts = new Date(ep.timestamp).getTime() / 1000;
        const recency_decay = 1 / (1 + 0.001 * (now - ts) / 3600);
        const score = 0.6 * semantic_sim + 0.25 * recency_decay + 0.15 * ep.importance;
        scoredEpisodes.push({ ...ep, score });
      }

      scoredEpisodes.sort((a, b) => b.score - a.score);
      const topEpisodes = scoredEpisodes.slice(0, topK);
      const topSemantic = this.store.getSemanticRecords(topK);
      const topProcedural = this.store.getProceduralRecords(topK);

      return { episodic: topEpisodes, semantic: topSemantic, procedural: topProcedural };
    } catch (err: any) {
      console.error(`[MEMORY - RETRIEVAL ERROR] Failed to retrieve context:`, err.message || err);
      return { episodic: [], semantic: [], procedural: [] };
    }
  }

  public async maybeConsolidate(): Promise<void> {
    const unconsolidated = this.store.getUnconsolidatedEpisodes(10);
    if (unconsolidated.length < 10) return;
    console.log(`[MEMORY - CONSOLIDATION] Starting consolidation for ${unconsolidated.length} episodes.`);
    await this._consolidate(unconsolidated);
  }

  private async _consolidate(episodes: EpisodicRecord[]): Promise<void> {
    try {
      const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
      const prompt = `Extract a single core factual claim from the following interactions. Return only a valid JSON object with the exact keys: 'claim' (string), 'confidence' (number between 0 and 1), and 'domain' (string).\n\nInteractions:\n` + episodes.map(e => e.raw_exchange).join('\n');
      
      const response = await adapter.reason(prompt, {
        systemInstruction: "You are an AI memory consolidation engine. Extract facts as JSON without any markdown formatting.",
        generationConfig: { responseMimeType: "application/json" }
      });

      const parsedText = response.text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      const parsed = JSON.parse(parsedText);
      const distilled_from = episodes.map(e => e.id).join(',');
      
      await this._upsertSemanticFact(parsed.claim || 'Unknown', parsed.confidence || 0.5, parsed.domain || 'general', distilled_from);
      this.store.markAsConsolidated(episodes.map(e => e.id));
      console.log(`[MEMORY - CONSOLIDATION] Successfully consolidated ${episodes.length} episodes.`);
    } catch (error: any) {
      console.error(`[MEMORY - CONSOLIDATION ERROR] Internal failure:`, error.message || error);
    }
  }

  private async _upsertSemanticFact(claim: string, confidence: number, domain: string, distilled_from: string): Promise<void> {
    try {
      const embeddingArray = await this.cognitive.getEmbedding(claim);
      const embeddingBuffer = Buffer.from(embeddingArray.buffer, embeddingArray.byteOffset, embeddingArray.byteLength);
      this.store.insertSemantic({ claim, confidence, domain, distilled_from, embedding: embeddingBuffer });
    } catch (err: any) {
      console.error(`[MEMORY - SEMANTIC ERROR] Failed to upsert fact:`, err.message || err);
    }
  }

  public close(): void {
    this.store.close();
  }
}
