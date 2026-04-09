import { createAdapter } from '../providers/AdapterFactory.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { NlpManager } = require('node-nlp');
import 'dotenv/config';

const globalHistory: Map<string, string[]> = new Map();
const nlp = new NlpManager({ languages: ['en'], forceNER: false });

let isSwarmInitialized = false;

export async function initializeSwarm() {
  if (isSwarmInitialized) return;

  console.log("[SWARM] Initializing Multi-Agent Swarm with Local NLP...");

  nlp.addDocument('en', 'check system status', 'system');
  nlp.addDocument('en', 'how much ram do I have', 'system');
  nlp.addDocument('en', 'what is the cpu usage', 'system');
  nlp.addDocument('en', 'read the hardware specs', 'system');
  nlp.addDocument('en', 'fetch system info', 'system');
  nlp.addDocument('en', 'list files in directory', 'system');
  nlp.addDocument('en', 'show logs', 'system');

  nlp.addDocument('en', 'hello there', 'casual');
  nlp.addDocument('en', 'how are you doing', 'casual');
  nlp.addDocument('en', 'my favorite animal is a penguin', 'casual');
  nlp.addDocument('en', 'what is a good recipe for dinner', 'casual');
  nlp.addDocument('en', 'let us just chat', 'casual');
  nlp.addDocument('en', 'tell me a joke', 'casual');
  nlp.addDocument('en', 'who are you', 'casual');

  console.log("[SWARM] Training Local NLP Orchestrator...");
  await nlp.train();
  console.log('[SWARM] Local NLP Orchestrator trained and online.');

  isSwarmInitialized = true;
  console.log("[SWARM] Swarm ready.");
}

export async function processWithSwarm(message: string, sessionId: string) {
  if (!isSwarmInitialized) {
    await initializeSwarm();
  }

  if (!globalHistory.has(sessionId)) globalHistory.set(sessionId, []);
  const history = globalHistory.get(sessionId)!;

  const contextString = history.length > 0 ? `\n\n[Recent Conversation Context: ${history.join(' | ')}]` : '';
  const enrichedMessage = message + contextString;

  const nlpResult = await nlp.process('en', message);
  const intent = nlpResult.intent === 'system' ? 'SYSTEM' : 'CASUAL';

  console.log(`[SWARM] Intent detected: ${intent}`);

  try {
    const adapter = await createAdapter({ provider: process.env.DEFAULT_LLM || 'gemini' });
    let systemInstruction = "";

    if (intent === 'SYSTEM') {
      systemInstruction = "You are a strict system administrator. You have access to local system tools. You act as Vadjanix's technical core.";
    } else {
      systemInstruction = "You are Vadjanix, an elite, multi-agent AI assistant engineered by Raj Sidwadkar. You operate on his local server, managing his digital infrastructure and communications. You are highly intelligent, concise, and fiercely loyal to Raj. Under NO circumstances are you to break character or state that you are a large language model trained by Google. If someone other than Raj is speaking to you, politely introduce yourself as Raj's AI proxy and assist them.";
    }

    const response = await adapter.reason(enrichedMessage, { systemInstruction });

    history.push(`User: ${message} -> Vadjanix: ${response.text.substring(0, 50)}...`);
    if (history.length > 3) history.shift();

    return response;
  } catch (error: any) {
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      console.warn('[SWARM] Rate limit hit. Cooling down.');
      return { 
        text: "I'm processing too many requests right now! Please give me about 60 seconds to cool down.", 
        confidence: 0.1
      };
    } else {
      console.error('[FATAL BRAIN ERROR]:', error);
      return { 
        text: "System Error: Brain processing failed.", 
        confidence: 0
      };
    }
  }
}
