import express from 'express';
import { IntentPacket } from '../router/schema.js';
import { processIncomingPacket } from '../brain/engine.js';
import { initializeSwarm, processWithSwarm } from '../brain/SwarmManager.js';
import 'dotenv/config';

/**
 * Parses a Telegram update into an internal IntentPacket.
 */
export function parseTelegramUpdate(body: any): IntentPacket | null {
  if (body?.message?.text && body?.message?.chat?.id) {
    return {
      from: `telegram://${body.message.chat.id}`,
      to: 'vadjanix://brain',
      action: 'write',
      payload: {
        message: body.message.text
      },
      reasoning: 'Telegram incoming message'
    };
  }
  return null;
}

/**
 * Sends a message back to Telegram.
 */
export async function sendTelegramMessage(chatId: string, text: string, botToken: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

/**
 * Initializes the Telegram webhook route.
 */
export function initializeTelegramWebhook(app: express.Application) {
  app.post('/webhook', async (req, res) => {
    // Immediately return 200 to prevent Telegram from timing out
    res.sendStatus(200);

    const packet = parseTelegramUpdate(req.body);
    if (packet) {
      const chatId = packet.from.replace('telegram://', '');
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (botToken) {
        // Process the Swarm logic asynchronously
        const sessionId = `telegram-${chatId}`;
        (async () => {
          try {
            const llmResponse = await processWithSwarm(packet.payload.message, sessionId);
            await sendTelegramMessage(chatId, llmResponse.text || "I processed your request.", botToken);
          } catch (error: any) {
            // CRITICAL BUG FIX: Expose the raw error object for better debugging
            console.error('\n[FATAL BRAIN ERROR]:', error);
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
}
