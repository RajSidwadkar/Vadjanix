import { ChannelAdapter, InboundMessage } from './types.js';
import { WhatsAppAdapter } from './whatsapp_adapter.js';
import { TelegramAdapter } from './telegram_adapter.js';
import { DiscordAdapter } from './discord_adapter.js';
import { NostrAdapter } from './nostr_adapter.js';
import { SessionManager } from './session_manager.js';
import { VadjanixAgent } from '../core/agent.js';

export class ChannelManager {
  private adapters: Map<string, ChannelAdapter> = new Map();
  private sessionManager = new SessionManager();

  constructor(private agent: VadjanixAgent) {
    this.adapters.set('whatsapp', new WhatsAppAdapter());
    this.adapters.set('telegram', new TelegramAdapter());
    this.adapters.set('discord', new DiscordAdapter());
    this.adapters.set('nostr', new NostrAdapter());
  }

  public async initialize(): Promise<void> {
    for (const [name, adapter] of this.adapters.entries()) {
      try {
        adapter.onMessage(async (msg: InboundMessage) => {
          console.log(`[CHANNEL - ${name.toUpperCase()}] Inbound from ${msg.from}`);
          
          // Update session
          this.sessionManager.updateSession(msg.from, name, {});
          
          // Handle via agent
          const response = await this.agent.handleIncomingMessage(name, msg.from, msg.content);
          
          if (response) {
            await adapter.send(msg.from, response);
          }
        });

        await adapter.initialize();
        console.log(`[CHANNEL - ${name.toUpperCase()}] Initialized.`);
      } catch (err: any) {
        console.error(`[CHANNEL - ${name.toUpperCase()}] Failed to initialize:`, err.message);
      }
    }
  }

  public async stop(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.stop();
    }
  }

  public getAdapter(name: string): ChannelAdapter | undefined {
    return this.adapters.get(name);
  }

  public async sendProactive(channel: string, to: string, message: string): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (adapter) {
      await adapter.send(to, message);
    }
  }
}
