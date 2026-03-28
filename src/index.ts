import express from 'express';
import 'dotenv/config';
import { initializeTelegramWebhook } from './adapters/telegram.js';
import { initializeDiscordBot } from './adapters/discord.js';
import { initializeWhatsApp } from './adapters/whatsapp.js';
import { initializeSwarm } from './brain/SwarmManager.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middleware for JSON payloads
app.use(express.json());

// 2. Health check route
app.get('/', (req, res) => {
  res.send('Vadjanix Node is Online');
});

async function boot() {
  console.log("[VADJANIX] Starting boot sequence...");

  // 0. Initialize the Multi-Agent Swarm (Trains the local NLP orchestrator)
  await initializeSwarm();

  // 3. Mount Adapter Webhooks
  initializeTelegramWebhook(app);

  // 4. Initialize Independent Bot Clients
  await initializeDiscordBot();
  await initializeWhatsApp();

  // 5. Start the Global Router
  app.listen(PORT, () => {
    console.log(`[VADJANIX] Boot sequence complete.`);
    console.log(`[VADJANIX] Express server listening on port ${PORT}`);
  });
}

boot().catch(err => {
  console.error("[VADJANIX] FATAL BOOT ERROR:", err);
  process.exit(1);
});
