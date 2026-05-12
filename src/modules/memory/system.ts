import * as fs from 'fs';
import * as path from 'path';
import { MemoryStore } from './store.js';
import { CognitiveEngine } from './engine.js';
import { EpisodicRecord, SemanticRecord, ProceduralRecord } from './schema.js';
import { createAdapter } from '../../infrastructure/adapters/AdapterFactory.js';

export interface EpisodicResult extends EpisodicRecord {
  score: number;
}

export interface SemanticResult extends SemanticRecord {
  score: number;
}

export interface RetrievalResult {
  episodic: EpisodicResult[];
  semantic: SemanticResult[];
  procedural: ProceduralRecord[];
}

export class VadjanixMemory {
  private store: MemoryStore;
  private cognitive: CognitiveEngine;

  constructor(
    store?: MemoryStore,
    cognitive?: CognitiveEngine
  ) {
    this.store = store || new MemoryStore();
    this.cognitive = cognitive || new CognitiveEngine();
  }

  private getProtectedJids(): string[] {
    try {
      const contactsPath = path.resolve('config/CONTACTS.json');
      if (fs.existsSync(contactsPath)) {
        const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        return contacts.protected || [];
      }
    } catch (err) {
      console.error(`[MEMORY - CONFIG ERROR] Failed to read CONTACTS.json:`, err);
    }
    return [];
  }

  public async writeEpisode(data: Omit<EpisodicRecord, 'id' | 'timestamp' | 'consolidated' | 'embedding' | 'read_only'>): Promise<string> {
    try {
      const protectedJids = this.getProtectedJids();
      let agent_action = data.agent_action;
      let read_only = 0;

      if (protectedJids.includes(data.counterparty_id)) {
        agent_action = null;
        read_only = 1;
      }

      const embeddingArray = await this.cognitive.getEmbedding(data.raw_exchange);
      const embeddingBuffer = Buffer.from(embeddingArray.buffer, embeddingArray.byteOffset, embeddingArray.byteLength);

      const id = this.store.insertEpisodic({ 
        ...data, 
        agent_action,
        read_only,
        domain: data.domain || 'general',
        embedding: embeddingBuffer 
      });
      this.maybe_consolidate().catch((err) => {
        console.error(`[MEMORY - CONSOLIDATION ERROR] Floating promise failed:`, err.message || err);
      });
      return id.toString();
    } catch (err: any) {
      console.error(`[MEMORY - WRITE ERROR] Failed to write episode:`, err.message || err);
      throw err;
    }
  }

  // Alias for prompt requirement
  public async write_episode(data: any) { return this.writeEpisode(data); }

  public writeCausalEdge(cause: string, effect: string, probability: number, conditions: string, mechanism: string, evidence: string, verified: number = 0): void {
    try {
      this.store.insertCausal({ cause, effect, probability, conditions, mechanism, evidence, verified });
    } catch (err: any) {
      console.error(`[MEMORY - CAUSAL ERROR] Failed to write causal edge:`, err.message || err);
    }
  }

  // Alias for prompt requirement
  public write_causal_edge(...args: any[]) { (this.writeCausalEdge as any)(...args); }

  public async retrieve(query: string, top_k: number = 5, includeReadOnly: boolean = false): Promise<RetrievalResult> {
    try {
      const queryEmbedding = await this.cognitive.getEmbedding(query);
      const now = Date.now() / 1000;
      const allEpisodes = this.store.getAllEpisodes(1000, includeReadOnly ? null : 0);
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
      const topEpisodes = scoredEpisodes.slice(0, top_k);

      // Scored Semantic Retrieval
      const allSemantic = this.store.getAllSemantic();
      const scoredSemantic: SemanticResult[] = [];
      for (const sem of allSemantic) {
        const semEmbedding = new Float32Array(sem.embedding.buffer, sem.embedding.byteOffset, sem.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT);
        const sim = this.cognitive.cosineSimilarity(queryEmbedding, semEmbedding);
        const score = 0.8 * sim + 0.2 * sem.confidence;
        scoredSemantic.push({ ...sem, score });
      }
      scoredSemantic.sort((a, b) => b.score - a.score);
      const topSemantic = scoredSemantic.slice(0, top_k);

      const topProcedural = this.store.getProceduralRecords(top_k);

      return { episodic: topEpisodes, semantic: topSemantic, procedural: topProcedural };
    } catch (err: any) {
      console.error(`[MEMORY - RETRIEVAL ERROR] Failed to retrieve context:`, err.message || err);
      return { episodic: [], semantic: [], procedural: [] };
    }
  }

  public async maybe_consolidate(): Promise<void> {
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
