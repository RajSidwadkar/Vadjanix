import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');
import { IAdapter } from '../../core/IAdapter.js';
import { VadjanixAgent } from '../../core/agent.js';

export class WhatsAppAdapter implements IAdapter {
  private client: any;

  constructor(private agent: VadjanixAgent) {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });
  }

  public async initialize(): Promise<void> {
    this.client.on('qr', (qr: string) => {
      qrcode.generate(qr, { small: true });
      console.log('\n[WHATSAPP] Scan the QR code above!');
    });

    this.client.on('ready', () => {
      console.log('[WHATSAPP] Client is ready!');
    });

    this.client.on('message', async (message: any) => {
      if (message.from === 'status@broadcast') return;
      if (!message.body) return;

      console.log(`[WHATSAPP] Received message from ${message.from}: ${message.body}`);
      console.log('[ADAPTER] Agent exists?', !!this.agent);
      console.log('[ADAPTER] Routing to Brain...');

      try {
        const response = await this.agent.handleIncomingMessage('whatsapp', message.from, message.body);
        if (response) {
          const cleanText = response
            .replace(/\*\*(.*?)\*\*/g, '*$1*')
            .replace(/^\* (.*$)/gm, '• $1')
            .replace(/^- (.*$)/gm, '• $1');
          await message.reply(cleanText);
        }
      } catch (error: any) {
        console.error('[WHATSAPP ERROR]', error);
        await message.reply("⚠️ Sorry, my Brain is having some trouble processing that.");
      }
    });

    await this.client.initialize();
  }
}
