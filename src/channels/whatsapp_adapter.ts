import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { ChannelAdapter, InboundMessage } from './types.js';

export class WhatsAppAdapter implements ChannelAdapter {
  private sock: any;
  private messageHandler?: (msg: InboundMessage) => Promise<void>;
  private connected = false;
  private contacts: any = { owner: '', protected: [], agents: [] };

  constructor() {
    this._loadContacts();
  }

  private _loadContacts() {
    try {
      const contactsPath = path.join(process.cwd(), 'config', 'CONTACTS.json');
      if (fs.existsSync(contactsPath)) {
        this.contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      }
    } catch (e) {}
  }

  public async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // We'll handle it manually
      browser: ['Vadjanix', 'Chrome', '1.0.0']
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[CHANNEL - WHATSAPP] QR Code received. Scan with your phone:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        this.connected = false;
        if (shouldReconnect) this.initialize();
      } else if (connection === 'open') {
        console.log('[CHANNEL - WHATSAPP] Connection opened successfully');
        this.connected = true;
      }
    });

    this.sock.ev.on('messages.upsert', async (m: { messages: proto.IWebMessageInfo[], type: string }) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key?.fromMe && msg.message) {
            const jid = msg.key?.remoteJid!;
            if (!jid || isJidBroadcast(jid) || isJidGroup(jid)) continue;

            // Contact classification FIRST
            const isOwner = jid === this.contacts.owner;
            const isProtected = this.contacts.protected?.includes(jid);
            
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         '';

            if (!text || text.trim().length === 0) {
              // Ignore empty messages (likely history placeholders or media we don't handle yet)
              continue;
            }

            if (this.messageHandler) {
              await this.messageHandler({
                channel: 'whatsapp',
                from: jid,
                content: text,
                timestamp: (msg.messageTimestamp as number) * 1000,
                raw: { isOwner, isProtected, msg }
              });
            }
          }
        }
      }
    });
  }

  public async send(to: string, message: string): Promise<void> {
    if (!this.connected) throw new Error('WhatsApp not connected');
    await this.sock.sendMessage(to, { text: message });
  }

  public onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async stop(): Promise<void> {
    this.sock?.end();
  }
}
