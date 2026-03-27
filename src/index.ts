import express from 'express';
import 'dotenv/config';
import { parseTelegramUpdate, sendTelegramMessage } from './router/telegram.js';
import { processIncomingPacket } from './brain/engine.js';
import { initializeDiscordBot } from './adapters/discord.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Middleware to read JSON payloads
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Vadjanix Node is Online');
});

app.post('/webhook/telegram', async (req, res) => {
  // Immediately return 200 to prevent Telegram from timing out
  res.sendStatus(200);

  const packet = parseTelegramUpdate(req.body);
  if (packet) {
    const chatId = packet.from.replace('telegram://', '');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken) {
      // Process the Brain logic asynchronously
      (async () => {
        try {
          const responsePacket = await processIncomingPacket(packet);
          await sendTelegramMessage(chatId, responsePacket.payload.message, botToken);
        } catch (error: any) {
          console.error('[BRAIN] Processing error:', error.message);
          try {
            await sendTelegramMessage(chatId, "System Error: Brain processing failed.", botToken);
          } catch (sendError: any) {
            console.error('[TELEGRAM] Failed to send fallback error message:', sendError.message);
          }
        }
      })();
    } else {
      console.error('[TELEGRAM] Error: TELEGRAM_BOT_TOKEN not set in .env');
    }
  }
});

app.listen(PORT, () => {
  console.log(`[VADJANIX] Router online at http://localhost:${PORT}`);
  
  // Initialize Discord Bot
  initializeDiscordBot();
});
