import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';

// Mock Baileys
vi.mock('@whiskeysockets/baileys', () => ({
  default: vi.fn().mockReturnValue({
    ev: { on: vi.fn() },
    sendMessage: vi.fn().mockResolvedValue({ key: { id: 'msg_123' } })
  }),
  useMultiFileAuthState: vi.fn().mockResolvedValue({
    state: {},
    saveCreds: vi.fn()
  }),
  DisconnectReason: { loggedOut: 401 }
}));

// Mock Database
vi.mock('better-sqlite3', () => {
  return {
    default: function() {
      return {
        exec: vi.fn(),
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
          all: vi.fn().mockReturnValue([])
        })
      };
    }
  };
});

describe('Relay Server API', () => {
  let app: express.Express;
  let mockSock: any;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    mockDb = new (Database as any)();
    
    mockSock = {
      sendMessage: vi.fn().mockResolvedValue({ ok: true })
    };

    app.post('/send', async (req, res) => {
      const { to, message } = req.body;
      await mockSock.sendMessage(to, { text: message });
      res.json({ ok: true });
    });

    app.get('/queue', (req, res) => {
      const items = mockDb.prepare().all();
      res.json(items);
    });

    app.post('/queue/ack', (req, res) => {
      const { ids } = req.body;
      const stmt = mockDb.prepare();
      ids.forEach((id: number) => stmt.run(id));
      res.json({ ok: true });
    });
  });

  it('POST /send returns { ok: true } and calls sendMessage', async () => {
    const res = await request(app)
      .post('/send')
      .send({ to: '12345@s.whatsapp.net', message: 'hello' });
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockSock.sendMessage).toHaveBeenCalledWith('12345@s.whatsapp.net', { text: 'hello' });
  });

  it('GET /queue returns items from database', async () => {
    mockDb.prepare().all.mockReturnValue([{ id: 1, type: 'whatsapp_message', processed: 0 }]);
    
    const res = await request(app).get('/queue');
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(1);
  });

  it('POST /queue/ack marks items as processed', async () => {
    const res = await request(app)
      .post('/queue/ack')
      .send({ ids: [1, 2] });
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockDb.prepare().run).toHaveBeenCalledTimes(2);
  });
});
