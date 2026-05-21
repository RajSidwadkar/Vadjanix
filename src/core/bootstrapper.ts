import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { MemoryStore } from '../modules/memory/store.js';
import { CognitiveEngine } from '../modules/memory/engine.js';
import { VadjanixMemory } from '../modules/memory/system.js';
import { VadjanixAgent } from './agent.js';
import { MCQCoordinator } from '../modules/autonomy/mcq_coordinator.js';
import { ChannelManager } from '../channels/channel_manager.js';
import { createAdapter } from '../infrastructure/adapters/AdapterFactory.js';
import { SecureVault } from '../security/vault.js';
import { SyncClient } from '../relay/sync_client.js';

export class Bootstrapper {
    public static async ignite() {
        const app = express();
        app.use(express.json());
        
        const masterPassword = process.env.MASTER_PASSWORD || 'default-password';
        const vault = new SecureVault(masterPassword);
        const syncClient = new SyncClient();

        console.log('[SYSTEM] -> Checking for newer snapshots from relay...');
        await syncClient.checkForNewerSnapshot(vault);

        const store = new MemoryStore();
        const cognitive = new CognitiveEngine();
        const memory = new VadjanixMemory(store, cognitive);
        const mcq = new MCQCoordinator();
        
        let config = { provider: 'hybrid' };
        try {
            const configData = await fs.readFile(path.join(process.cwd(), 'config.json'), 'utf-8');
            config = JSON.parse(configData);
        } catch (e) {}

        const llmRouter = await createAdapter({ provider: process.env.DEFAULT_LLM || config.provider || 'hybrid' }, vault);
        if (llmRouter.warmup) {
            // Non-blocking warmup
            llmRouter.warmup().catch(err => console.error('[SYSTEM - WARMUP ERROR]', err));
        }
        
        const agent = new VadjanixAgent(memory, llmRouter);
        
        const channels = new ChannelManager(agent);
        await channels.initialize();

        const { HeartbeatManager } = await import('../agent/heartbeat.js');
        const heartbeat = new HeartbeatManager();
        heartbeat.start(agent, vault);

        return {
            agent,
            apiServer: app,
            channels,
            mcq
        };
    }
}
