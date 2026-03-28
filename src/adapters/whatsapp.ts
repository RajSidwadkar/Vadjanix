import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');
import { processWithSwarm, initializeSwarm } from '../brain/SwarmManager.js';
import 'dotenv/config';

/**
 * Initializes the WhatsApp Web client and event listeners.
 */
export async function initializeWhatsApp() {
  console.log('[WHATSAPP] Initializing client...');

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // 1. QR Event: Display QR code in the terminal
  client.on('qr', (qr: string) => {
    qrcode.generate(qr, { small: true });
    console.log('\n[WHATSAPP] Scan the QR code above!');
  });

  // 2. Ready Event: Connection successful
  client.on('ready', () => {
    console.log('[WHATSAPP] Client is ready and linked to your phone!');
  });

  // 3. Message Event: Route to Swarm
  client.on('message', async (message: any) => {
    // Ignore status broadcasts
    if (message.from === 'status@broadcast') return;

    const text = message.body;
    if (!text) return;

    const sessionId = `whatsapp-${message.from}`;

    try {
      // Route to the Swarm
      const response = await processWithSwarm(text, sessionId);

      // Reply to the user
      if (response && response.text) {
        let cleanText = response.text
          .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert Gemini bold to WhatsApp bold
          .replace(/^\* (.*$)/gm, '• $1')    // Convert star bullets to solid bullets
          .replace(/^- (.*$)/gm, '• $1');    // Convert dash bullets to solid bullets

        await message.reply(cleanText);
      }
    } catch (error: any) {
      console.error('[WHATSAPP] Swarm processing failed:', error.message);
      try {
        await message.reply("⚠️ Sorry, my Brain is having some trouble processing that right now.");
      } catch (replyError: any) {
        console.error('[WHATSAPP] Failed to send fallback error message:', replyError.message);
      }
    }
  });

  // Boot the Client
  try {
    await client.initialize();
  } catch (error: any) {
    console.error('[WHATSAPP] Initialization failed:', error.message);
  }
}
