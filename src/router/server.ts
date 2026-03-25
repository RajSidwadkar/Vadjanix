import http from 'http';
import { IntentPacketSchema } from './schema.js';
import { logSecurityEvent } from './audit.js';
import { routePacket } from './index.js';

const PORT = process.env.PORT || 3000;
const MAX_PAYLOAD_SIZE = 1048576; // 1MB

const server = http.createServer(async (req, res) => {
  const source = req.socket.remoteAddress || 'unknown';

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

      // 2. Zod Validation
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
