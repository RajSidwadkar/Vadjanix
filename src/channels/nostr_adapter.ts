import { SimplePool, finalizeEvent, verifyEvent, Filter, Event } from 'nostr-tools';
import { ChannelAdapter, InboundMessage } from './types.js';
import { AgentIdentity } from '../config/identity.js';
import fs from 'fs';
import path from 'path';

export class NostrAdapter implements ChannelAdapter {
  private pool: SimplePool;
  private messageHandler?: (msg: InboundMessage) => Promise<void>;
  private relays: string[] = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
  private connected = false;

  constructor() {
    this.pool = new SimplePool();
  }

  private _auditLog(entry: Record<string, unknown>): void {
    const auditPath = path.join(process.cwd(), 'audit.log');
    const logLine = JSON.stringify({ ts: new Date().toISOString(), type: 'NOSTR_SECURITY', ...entry }) + '\n';
    fs.appendFileSync(auditPath, logLine, 'utf-8');
  }

  public async initialize(): Promise<void> {
    const pubkey = AgentIdentity.publicKey;
    const filter: Filter = { kinds: [1], '#p': [pubkey] }; // NIP-01 and direct mentions

    this.pool.subscribeMany(
      this.relays,
      filter,
      {
        onevent: async (event: Event) => {
          // Verify signature on EVERY inbound event
          if (!verifyEvent(event)) {
            this._auditLog({ 
              event: 'INVALID_SIGNATURE', 
              id: event.id, 
              pubkey: event.pubkey,
              message: 'Rejected unsigned or invalid event'
            });
            return; // reject silently
          }

          if (this.messageHandler) {
            await this.messageHandler({
              channel: 'nostr',
              from: event.pubkey,
              content: event.content,
              timestamp: event.created_at * 1000,
              raw: event
            });
          }
        },
        oneose: () => {
          this.connected = true;
        }
      }
    );
  }

  public async send(to: string, message: string): Promise<void> {
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', to]],
      content: message,
    };
    const signedEvent = finalizeEvent(eventTemplate, Buffer.from(AgentIdentity.privateKey, 'hex'));
    await Promise.any(this.pool.publish(this.relays, signedEvent));
  }

  public onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async stop(): Promise<void> {
    this.pool.close(this.relays);
    this.connected = false;
  }
}
