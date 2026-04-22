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
        
        const primaryLLM = new OllamaAdapter();
        const secondaryLLM = new GeminiAdapter();
        const llmProvider = new FallbackLLMProvider(primaryLLM, secondaryLLM);
        
        const agent = new VadjanixAgent(memory, llmProvider);
        
        const discord = new DiscordAdapter(agent);
        const whatsapp = new WhatsAppAdapter(agent);
        const telegram = new TelegramAdapter(app, agent);
        
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
