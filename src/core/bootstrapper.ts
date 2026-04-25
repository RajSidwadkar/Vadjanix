import express from 'express';
import { SecureVault } from '../modules/security/vault.js';
import { MemoryStore } from '../modules/memory/store.js';
import { CognitiveEngine } from '../modules/memory/engine.js';
import { VadjanixMemory } from '../modules/memory/system.js';
import { VadjanixAgent } from './agent.js';
import { MCQCoordinator } from '../modules/autonomy/mcq_coordinator.js';
import { DiscordAdapter } from '../infrastructure/adapters/discord.js';
import { WhatsAppAdapter } from '../infrastructure/adapters/whatsapp.js';
import { TelegramAdapter } from '../infrastructure/adapters/telegram.js';
import { GemmaLocalAdapter } from '../infrastructure/adapters/GemmaLocalAdapter.js';
import { OllamaAdapter } from '../infrastructure/adapters/OllamaAdapter.js';
import { GeminiAdapter } from '../infrastructure/adapters/GeminiAdapter.js';
import { FallbackLLMProvider } from '../infrastructure/adapters/FallbackLLMProvider.js';

export class Bootstrapper {
    public static async ignite() {
        const app = express();
        app.use(express.json());
        
        const store = new MemoryStore();
        const cognitive = new CognitiveEngine();
        const memory = new VadjanixMemory(store, cognitive);
        const mcq = new MCQCoordinator();
        
        // 1. Initialize the Tri-Brain Router
        const llmProvider = new FallbackLLMProvider([
            new GemmaLocalAdapter(),
            new OllamaAdapter(),
            new GeminiAdapter()
        ]);
        
        // 2. Instantiate the Core Brain
        const agent = new VadjanixAgent(memory, llmProvider);
        
        // 3. Instantiate the Sensory Adapters
        const discord = new DiscordAdapter(agent);
        const whatsapp = new WhatsAppAdapter(agent);
        const telegram = new TelegramAdapter(agent);

        return {
            agent,
            apiServer: app,
            discord,
            whatsapp,
            telegram,
            mcq
        };
        }
        }