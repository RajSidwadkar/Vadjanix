import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import Database from 'better-sqlite3';
import express from 'express';
import { Boom } from '@hapi/boom';

const app = express();
app.use(express.json());
const db = new Database('relay_queue.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, payload TEXT, processed INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS pending_mcqs (id TEXT PRIMARY KEY, question TEXT, options TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

async function startRelay() {
  const { state, saveCreds } = await useMultiFileAuthState('wa_auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (upd) => {
    if (upd.connection === 'close') {
      const shouldReconnect = (upd.lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startRelay();
    }
  });

  sock.ev.on('messages.upsert', (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) db.prepare('INSERT INTO queue (type, payload) VALUES (?, ?)').run('whatsapp_message', JSON.stringify(msg));
      }
    }
  });

  app.post('/send', async (req, res) => {
    const { to, message } = req.body;
    await sock.sendMessage(to, { text: message });
    res.json({ ok: true });
  });

  app.get('/queue', (req, res) => {
    const items = db.prepare('SELECT * FROM queue WHERE processed = 0 ORDER BY created_at LIMIT 500').all();
    res.json(items);
  });

  app.post('/queue/ack', (req, res) => {
    const { ids } = req.body;
    const stmt = db.prepare('UPDATE queue SET processed = 1 WHERE id = ?');
    ids.forEach((id: number) => stmt.run(id));
    res.json({ ok: true });
  });

  app.get('/pending_mcqs', (req, res) => res.json(db.prepare('SELECT * FROM pending_mcqs').all()));
  
  app.post('/pending_mcqs', (req, res) => {
    const { id, question, options } = req.body;
    db.prepare('INSERT INTO pending_mcqs (id, question, options) VALUES (?, ?, ?)').run(id, question, JSON.stringify(options));
    res.json({ ok: true });
  });

  app.post('/snapshot', (req, res) => {
    db.prepare('INSERT INTO snapshots (data) VALUES (?)').run(Buffer.from(req.body.data, 'hex'));
    res.json({ ok: true });
  });

  app.listen(3001, '0.0.0.0', () => console.log('Relay listening on :3001'));
}

startRelay();
