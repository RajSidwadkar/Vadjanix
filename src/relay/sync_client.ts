import 'dotenv/config';
import fs from 'node:fs';
import { SecureVault } from '../security/vault.js';
import { SnapshotManager } from './snapshot_manager.js';

const RELAY_IP = process.env.RELAY_IP;
const RELAY_PORT = 3001;
const RELAY_URL = `http://${RELAY_IP}:${RELAY_PORT}`;

export type QueueItemHandler = (item: any) => Promise<void>;

export class SyncClient {
  private snapshotManager = new SnapshotManager();
  private lastSnapshotTimestamp = 0;
  private readonly timestampPath = '.last_snapshot_ts';
  private itemHandler: QueueItemHandler | null = null;

  constructor() {
    if (fs.existsSync(this.timestampPath)) {
      try {
        this.lastSnapshotTimestamp = parseInt(fs.readFileSync(this.timestampPath, 'utf8'), 10);
      } catch (e) {
        this.lastSnapshotTimestamp = 0;
      }
    }
  }

  public setItemHandler(handler: QueueItemHandler): void {
    this.itemHandler = handler;
  }

  private saveTimestamp(ts: number) {
    this.lastSnapshotTimestamp = ts;
    fs.writeFileSync(this.timestampPath, ts.toString());
  }

  async pollQueue(): Promise<void> {
    if (!RELAY_IP) return;
    try {
      const response = await fetch(`${RELAY_URL}/queue`);
      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          console.log(`[SYNC] Processing ${items.length} items from queue`);
          
          const processedIds: number[] = [];
          for (const item of items) {
            try {
              if (this.itemHandler) {
                await this.itemHandler(item);
              }
              processedIds.push(item.id);
            } catch (err) {
              console.error(`[SYNC] Failed to process item ${item.id}:`, err);
            }
          }
          
          if (processedIds.length > 0) {
            await fetch(`${RELAY_URL}/queue/ack`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: processedIds })
            });
          }
        }
      }
    } catch (e) {
      // Relay unreachable
    }
  }

  public startPolling(intervalMs: number = 30000): void {
    setInterval(() => this.pollQueue(), intervalMs);
  }

  async sendRelayMessage(to: string, message: string): Promise<boolean> {
    if (!RELAY_IP) return false;
    try {
      const response = await fetch(`${RELAY_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      return response.ok;
    } catch (e) {
      console.error('[SYNC] Failed to send message through relay:', e);
      return false;
    }
  }

  async pushSnapshot(vault: SecureVault): Promise<boolean> {
    if (!RELAY_IP) return false;
    try {
      console.log('[SYNC] Creating snapshot for push...');
      const { data, checksum } = await this.snapshotManager.createSnapshot(vault);
      const response = await fetch(`${RELAY_URL}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: data.toString('base64'),
          checksum
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.timestamp) {
          this.saveTimestamp(result.timestamp);
        }
        console.log('[SYNC] Snapshot pushed successfully');
        return true;
      } else {
        console.error('[SYNC] Failed to push snapshot:', response.statusText);
        return false;
      }
    } catch (e) {
      console.error('[SYNC] Failed to push snapshot:', e);
      return false;
    }
  }

  async checkForNewerSnapshot(vault: SecureVault): Promise<boolean> {
    if (!RELAY_IP) return false;
    try {
      const response = await fetch(`${RELAY_URL}/snapshot`);
      if (response.ok) {
        const info = await response.json();
        if (info && info.timestamp > this.lastSnapshotTimestamp) {
          console.log(`[SYNC] Newer snapshot found (${info.timestamp} > ${this.lastSnapshotTimestamp})`);
          const data = Buffer.from(info.data, 'base64');
          const success = await this.snapshotManager.restoreSnapshot(data, info.checksum, vault);
          if (success) {
            this.saveTimestamp(info.timestamp);
            console.log('[SYNC] Snapshot restored successfully');
            return true;
          }
        }
      }
    } catch (e) {
      // Relay unreachable
    }
    return false;
  }
}
