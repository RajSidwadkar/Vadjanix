import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');
import { IAdapter } from '../../core/IAdapter.js';
import { VadjanixAgent } from '../../core/agent.js';

export class WhatsAppAdapter implements IAdapter {
  private client: any;
  private errorCooldowns = new Set<string>();

  constructor(private agent: VadjanixAgent) {}

  public async initialize(): Promise<void> {
    let retries = 3;
    while (retries > 0) {
      try {
        this.client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--disable-site-isolation-trials',
              '--disable-features=site-per-process'
            ]
          }
        });

        this.client.on('qr', (qr: string) => {
          qrcode.generate(qr, { small: true });
          console.log('\n[WHATSAPP] Scan the QR code above!');
        });

        this.client.on('ready', () => {
          console.log('[WHATSAPP] Client is ready!');
        });

        this.client.on('message_create', async (message: any) => {
          if (!message.fromMe || message.from !== message.to) return;
          if (!message.body) return;

          try {
            const response = await this.agent.handleIncomingMessage('whatsapp', message.from, message.body);
            if (response) {
              const cleanText = response
                .replace(/\*\*(.*?)\*\*/g, '*$1*')
                .replace(/^\* (.*$)/gm, '• $1')
                .replace(/^- (.*$)/gm, '• $1');

              console.log(`[OUTPUT - WHATSAPP] Attempting to send: "${cleanText.substring(0, 50)}..."`);
              try {
                await message.reply(cleanText);
                console.log(`[OUTPUT - WHATSAPP] ✅ Message sent successfully.`);
              } catch (err: any) {
                console.error(`[OUTPUT - FATAL] Failed to send via API:`, err.message || err);
              }
            }
          } catch (error: any) {
            console.error('[WHATSAPP ERROR]', error);
            if (!this.errorCooldowns.has(message.from)) {
              try {
                await message.reply("System Error: Brain offline");
                this.errorCooldowns.add(message.from);
                setTimeout(() => this.errorCooldowns.delete(message.from), 300000);
              } catch (err: any) {
                console.error(`[OUTPUT - FATAL] Failed to send error message:`, err.message || err);
              }
            }
          }
        });

        await this.client.initialize();
        break;
      } catch (error: any) {
        if (error.message?.includes('Execution context was destroyed') && retries > 1) {
          console.warn('[WHATSAPP] DOM refreshed during injection. Retrying in 3s...');
          try {
            await this.client.destroy();
          } catch (cleanupError) {}
          await new Promise(resolve => setTimeout(resolve, 3000));
          retries--;
        } else {
          throw error;
        }
      }
    }
  }

  public async stop(): Promise<void> {
    console.log('[WHATSAPP] Destroying headless browser...');
    try {
      await this.client.destroy();
    } catch (err) {
    }
  }
}
