import { createAdapter } from '../infrastructure/adapters/AdapterFactory.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { NlpManager } = require('node-nlp');
import 'dotenv/config';

export class SwarmManager {
  private nlp = new NlpManager({ languages: ['en'], forceNER: false });
  private globalHistory: Map<string, string[]> = new Map();
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.nlp.addDocument('en', 'check system status', 'system');
    this.nlp.addDocument('en', 'how much ram do I have', 'system');
    this.nlp.addDocument('en', 'what is the cpu usage', 'system');
    this.nlp.addDocument('en', 'read the hardware specs', 'system');
    this.nlp.addDocument('en', 'fetch system info', 'system');
    this.nlp.addDocument('en', 'list files in directory', 'system');
    this.nlp.addDocument('en', 'show logs', 'system');
    this.nlp.addDocument('en', 'hello there', 'casual');
    this.nlp.addDocument('en', 'how are you doing', 'casual');
    this.nlp.addDocument('en', 'my favorite animal is a penguin', 'casual');
    this.nlp.addDocument('en', 'what is a good recipe for dinner', 'casual');
    this.nlp.addDocument('en', 'let us just chat', 'casual');
    this.nlp.addDocument('en', 'tell me a joke', 'casual');
    this.nlp.addDocument('en', 'who are you', 'casual');
    await this.nlp.train();
    this.isInitialized = true;
  }

  public async process(message: string, sessionId: string) {
    if (!this.isInitialized) await this.initialize();
    if (!this.globalHistory.has(sessionId)) this.globalHistory.set(sessionId, []);
    const history = this.globalHistory.get(sessionId)!;
    const contextString = history.length > 0 ? `\n\n[Context: ${history.join(' | ')}]` : '';
    const nlpResult = await this.nlp.process('en', message);
    const intent = nlpResult.intent === 'system' ? 'SYSTEM' : 'CASUAL';
    const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
    let systemInstruction = intent === 'SYSTEM' 
      ? "You are a system administrator for Vadjanix." 
      : "You are Vadjanix, an elite AI assistant.";
    const response = await adapter.reason(message + contextString, { systemInstruction });
    history.push(`User: ${message} -> Vadjanix: ${response.text.substring(0, 50)}...`);
    if (history.length > 3) history.shift();
    return response;
  }
}

const manager = new SwarmManager();
export const initializeSwarm = () => manager.initialize();
export const processWithSwarm = (message: string, sessionId: string) => manager.process(message, sessionId);
