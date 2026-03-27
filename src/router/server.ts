import http from 'http';
import 'dotenv/config';
import { IntentPacketSchema } from './schema.js';
import { logSecurityEvent } from './audit.js';
import { routePacket } from './index.js';
import { parseTelegramUpdate, sendTelegramMessage } from './telegram.js';
import { processIncomingPacket } from '../brain/engine.js';

const PORT = process.env.PORT || 3000;
const MAX_PAYLOAD_SIZE = 1048576; // 1MB

const server = http.createServer(async (req, res) => {
  const source = req.socket.remoteAddress || 'unknown';
  const url = req.url || '/';

  // 1. Payload Size Limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_PAYLOAD_SIZE) {
    logSecurityEvent('Payload Too Large', source, `Size: ${contentLength}`);
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payload Too Large' }));
    return req.destroy();
  }

  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_PAYLOAD_SIZE) {
        logSecurityEvent('Payload Overflow during stream', source, `Partial length: ${body.length}`);
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(body);
      } catch (e) {
        logSecurityEvent('JSON Parse Failure', source, body);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request: Invalid JSON' }));
        return;
      }

      // Handle Telegram Webhook
      if (url === '/webhook/telegram') {
        const intentPacket = parseTelegramUpdate(parsedJson);
        if (intentPacket) {
          try {
            // Forward to brain and await response
            const responsePacket = await processIncomingPacket(intentPacket);
            
            // Extract chat_id (strip telegram://)
            const chatId = responsePacket.to.replace('telegram://', '');
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            
            if (botToken) {
              await sendTelegramMessage(chatId, responsePacket.payload.message, botToken);
            } else {
              console.error('[TELEGRAM] Error: TELEGRAM_BOT_TOKEN not set');
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error: any) {
            console.error('[TELEGRAM] Error processing update:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        } else {
          // Acknowledge non-text messages with 200 to stop Telegram from retrying
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Ignored non-text update' }));
        }
        return;
      }

      // 2. Zod Validation for normal traffic
      const result = IntentPacketSchema.safeParse(parsedJson);
      if (!result.success) {
        const errorMessage = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        logSecurityEvent(`Zod Schema Failure | ${errorMessage}`, source, body);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Bad Request: ${errorMessage}` }));
        return;
      }

      // 3. Execution
      const routerResult = await routePacket(result.data);
      res.writeHead(routerResult.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(routerResult));
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[ROUTER SERVER] Gateway online at http://localhost:${PORT}`);
});

export default server;
