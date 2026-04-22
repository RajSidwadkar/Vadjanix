import { SimplePool, finalizeEvent, verifyEvent, Filter } from 'nostr-tools';
import { AgentIdentity } from '../../config/identity.js';
import { IntentPacket, IntentPacketSchema } from '../../router/schema.js';
import { IAdapter } from '../../core/IAdapter.js';

export class NostrAdapter implements IAdapter {
  private pool: SimplePool;
  private relays: string[] = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

  constructor() {
    this.pool = new SimplePool();
  }

  public async initialize(): Promise<void> {
    const pubkey = AgentIdentity.publicKey;
    const filter: Filter = { kinds: [29999], '#p': [pubkey] };
    this.pool.subscribeMany(
      this.relays,
      filter,
      {
        onevent: (event) => {
          if (!verifyEvent(event)) return;
          try {
            const parsed = JSON.parse(event.content);
            const result = IntentPacketSchema.safeParse(parsed);
            if (result.success) {
              console.log(`[NOSTR] Received verified packet from ${event.pubkey}`);
            }
          } catch (e) {}
        }
      }
    );
  }

  public async send(packet: IntentPacket): Promise<boolean> {
    try {
      let targetPubKey = packet.to.replace('vadjanix://', '').replace('vadjanix:', '').split('/')[0];
      const eventTemplate = {
        kind: 29999,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', targetPubKey]],
        content: JSON.stringify(packet),
      };
      const signedEvent = finalizeEvent(eventTemplate, Buffer.from(AgentIdentity.privateKey, 'hex'));
      await Promise.any(this.pool.publish(this.relays, signedEvent));
      return true;
    } catch (error) {
      return false;
    }
  }

  public static async nostrSend(packet: IntentPacket): Promise<boolean> {
    const adapter = new NostrAdapter();
    return adapter.send(packet);
  }
}
