import TelegramBot from 'node-telegram-bot-api';
import { ChannelAdapter, InboundMessage } from './types.js';

export class TelegramAdapter implements ChannelAdapter {
  private bot: TelegramBot;
  private messageHandler?: (msg: InboundMessage) => Promise<void>;
  private connected = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
    
    // In webhook mode, we don't use polling
    this.bot = new TelegramBot(token, { polling: false });
  }

  public async initialize(): Promise<void> {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    if (webhookUrl) {
      await this.bot.setWebHook(webhookUrl);
      console.log(`[TELEGRAM] Webhook set to ${webhookUrl}`);
    }

    this.bot.on('message', async (msg) => {
      if (msg.text && this.messageHandler) {
        await this.messageHandler({
          channel: 'telegram',
          from: msg.chat.id.toString(),
          content: msg.text,
          timestamp: msg.date * 1000,
          raw: msg
        });
      }
    });

    this.connected = true;
  }

  public async send(to: string, message: string): Promise<void> {
    await this.bot.sendMessage(to, message);
  }

  public onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async stop(): Promise<void> {
    await this.bot.deleteWebHook();
    this.connected = false;
  }

  // Helper for webhook processing
  public handleUpdate(update: any): void {
    this.bot.processUpdate(update);
  }
}
