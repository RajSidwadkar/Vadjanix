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
import { FallbackLLMProvider } from '../infrastructure/adapters/FallbackLLMProvider.js';

export class Bootstrapper {
    public static async ignite() {
        const app = express();
        app.use(express.json());
        
        const store = new MemoryStore();
        const cognitive = new CognitiveEngine();
        const memory = new VadjanixMemory(store, cognitive);
        const mcq = new MCQCoordinator();
        
        const llmRouter = new FallbackLLMProvider();
        
        const agent = new VadjanixAgent(memory, llmRouter);
        
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
