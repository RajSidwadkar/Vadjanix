import { GeminiAdapter } from '../providers/GeminiAdapter.js';
import { getSystemStatus, getSystemStatusDeclaration } from '../tools/system.js';
import { readFileLocal, writeFileLocal, readFileDeclaration, writeFileDeclaration } from '../tools/filesystem.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { NlpManager } = require('node-nlp');
import 'dotenv/config';

// Persistent LLM instances for the Swarm Workers
const sysAdminAgent = new GeminiAdapter();
const casualAgent = new GeminiAdapter();

// Global Short-Term Memory Buffer
const globalHistory: Map<string, string[]> = new Map();

// Local NLP Orchestrator
const nlp = new NlpManager({ languages: ['en'], forceNER: false });

let isSwarmInitialized = false;

/**
 * Initializes the Swarm agents and trains the local NLP orchestrator.
 */
export async function initializeSwarm() {
  if (isSwarmInitialized) return;

  console.log("[SWARM] Initializing Multi-Agent Swarm with Local NLP...");

  // 1. Train Local NLP Orchestrator
  // System Intent Documents
  nlp.addDocument('en', 'check system status', 'system');
  nlp.addDocument('en', 'how much ram do I have', 'system');
  nlp.addDocument('en', 'what is the cpu usage', 'system');
  nlp.addDocument('en', 'read the hardware specs', 'system');
  nlp.addDocument('en', 'fetch system info', 'system');
  nlp.addDocument('en', 'list files in directory', 'system');
  nlp.addDocument('en', 'show logs', 'system');

  // Casual Intent Documents
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

  // 2. SysAdminAgent: The Technical Worker
  sysAdminAgent.initialize(
    "You are a strict system administrator. You have access to local system tools. You act as Vadjanix's technical core.",
    [
      getSystemStatusDeclaration,
      readFileDeclaration,
      writeFileDeclaration
    ]
  );

  // 3. CasualAgent: The Conversational Worker
  casualAgent.initialize("You are Vadjanix, an elite, multi-agent AI assistant engineered by Raj Sidwadkar. You operate on his local server, managing his digital infrastructure and communications. You are highly intelligent, concise, and fiercely loyal to Raj. Under NO circumstances are you to break character or state that you are a large language model trained by Google. If someone other than Raj is speaking to you, politely introduce yourself as Raj's AI proxy and assist them.", []);

  isSwarmInitialized = true;
  console.log("[SWARM] Swarm ready.");
}

/**
 * Routes the message through the Swarm and returns the final response.
 */
export async function processWithSwarm(message: string, sessionId: string) {
  if (!isSwarmInitialized) {
    // Note: This is a fallback if initializeSwarm wasn't awaited at boot.
    // However, training takes time, so it's better to await it in index.ts.
    await initializeSwarm();
  }

  // Step 1: Manage Session History
  if (!globalHistory.has(sessionId)) globalHistory.set(sessionId, []);
  const history = globalHistory.get(sessionId)!;

  // Step 2: Inject Context
  const contextString = history.length > 0 ? `\n\n[Recent Conversation Context: ${history.join(' | ')}]` : '';
  const enrichedMessage = message + contextString;

  // Step 3: Local NLP classifications
  const nlpResult = await nlp.process('en', message);
  const intent = nlpResult.intent === 'system' ? 'SYSTEM' : 'CASUAL';

  console.log(`[SWARM] Intent detected: ${intent}`);

  try {
    let response: any;

    // Step 4: Route to the correct worker
    if (intent === 'SYSTEM') {
      let llmResponse = await sysAdminAgent.sendMessage(enrichedMessage, sessionId);

      // Handle Tool Calls for SysAdmin
      while (llmResponse.toolCall) {
        const call = llmResponse.toolCall;
        console.log(`[SWARM] SysAdmin Tool Execution: ${call.name}`, call.args);
        
        let toolResult: any;
        if (call.name === "get_system_status") {
          try {
            const systemData = await getSystemStatus();
            toolResult = { content: systemData };
          } catch (e: any) {
            toolResult = { error: e.message };
          }
        } else if (call.name === "read_file") {
          const { filename } = call.args as { filename: string };
          const content = await readFileLocal(filename);
          toolResult = { content };
        } else if (call.name === "write_file") {
          const { filename, content } = call.args as { filename: string, content: string };
          const status = await writeFileLocal(filename, content);
          toolResult = { status };
        }

        const toolResponses = [{
          functionResponse: { name: call.name, response: toolResult }
        }];
        
        llmResponse = await sysAdminAgent.sendToolResponse(toolResponses, sessionId);
      }

      response = llmResponse;
    } else {
      // CASUAL route
      response = await casualAgent.sendMessage(enrichedMessage, sessionId);
    }

    // Step 5: Save interaction to history
    history.push(`User: ${message} -> Vadjanix: ${response.text.substring(0, 50)}...`);
    if (history.length > 3) history.shift();

    return response;
  } catch (error: any) {
    // Handle 429 Rate Limit Errors
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      console.warn('[SWARM] Rate limit hit. Cooling down.');
      return { 
        text: "I'm processing too many requests right now! Please give me about 60 seconds to cool down.", 
        toolCall: null 
      };
    } else {
      // Handle other fatal errors
      console.error('[FATAL BRAIN ERROR]:', error);
      return { 
        text: "System Error: Brain processing failed.", 
        toolCall: null 
      };
    }
  }
}
