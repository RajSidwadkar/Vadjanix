import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { ChannelAdapter, InboundMessage } from './types.js';

export class WhatsAppAdapter implements ChannelAdapter {
  private sock: any;
  private messageHandler?: (msg: InboundMessage) => Promise<void>;
  private connected = false;
  private contacts: any = { owner: '', protected: [], agents: [] };
  private conflictCount = 0;

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
      printQRInTerminal: false,
      browser: ['Vadjanix', 'Chrome', '1.0.0'],
      logger: pino({ level: 'warn' }),
      // Active Mode Fixes
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false, // Bypass privacy settings crash
    });

    // 2-second debouncer for creds saving + Transactional Retry
    let saveTimeout: NodeJS.Timeout | null = null;
    this.sock.ev.on('creds.update', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          await saveCreds();
        } catch (err) {
          console.warn('[WHATSAPP] Auth save locked, retrying in 500ms...');
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await saveCreds();
          } catch (retryErr) {
            console.error('[WHATSAPP] Fatal Auth Save Error:', retryErr);
          }
        }
        saveTimeout = null;
      }, 2000);
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[CHANNEL - WHATSAPP] QR Code received. Scan with your phone:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isConflict = statusCode === 440 || lastDisconnect?.error?.message?.includes('conflict');
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('WhatsApp connection closed. Status:', statusCode, 'Conflict:', isConflict);
        this.connected = false;

        if (shouldReconnect) {
          if (isConflict) {
            this.conflictCount++;
            if (this.conflictCount > 3) {
              console.error('\x1b[31m%s\x1b[0m', '[SYSTEM] -> Multiple Session Conflict Detected. Please close other WhatsApp Web tabs.');
              return;
            }
            console.log(`[WHATSAPP] Conflict detected. Backing off for 5s (Attempt ${this.conflictCount}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            this.conflictCount = 0; // Reset on normal disconnects
          }
          this.initialize();
        }
      } else if (connection === 'open') {
        console.log('[CHANNEL - WHATSAPP] Connection opened successfully');
        this.connected = true;
        this.conflictCount = 0;
      }
    });

    this.sock.ev.on('messages.upsert', async (m: { messages: proto.IWebMessageInfo[], type: string }) => {
      if (m.type !== 'notify') return;
      
      for (const msg of m.messages) {
        try {
          // 1. Completely ignore WhatsApp Status broadcast noise
          if (msg.key?.remoteJid === 'status@broadcast') continue;
          
          // 2. Skip messages containing data phase protocol errors 
          if (msg.messageStubType) continue;

          const jid = msg.key?.remoteJid!;
          if (!jid) continue;

          // Rule 1: IGNORE GROUPS AT DECRYPTION
          if (jid.endsWith('@g.us') || isJidGroup(jid)) continue;
          
          if (isJidBroadcast(jid)) continue;

          // Rule 2: PRE-EMPTIVE SESSION FILTER
          if (msg.message?.protocolMessage || msg.message?.senderKeyDistributionMessage) {
            continue;
          }

          // Preservation: Process self-messages (Hermit Protocol) or inbound
          if (!msg.message) continue;

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
          } catch (error: any) {
            // Rule 3: SILENCE RE-ESTABLISHMENT LOGS AND DECRYPTION ERRORS
            if (error.message?.includes('decrypt') || error.message?.includes('No session found to decrypt message')) {
              console.log('\x1b[33m%s\x1b[0m', '[WHATSAPP] Establishing Secure Session or Skipping Decryption Error...');
              continue;
            } else {
              console.error('[CHANNEL - WHATSAPP] Error processing message:', error);
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
