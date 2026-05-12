import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class AuditChain {
  private static readonly AUDIT_CHAIN_PATH = path.join(process.cwd(), 'audit.log');
  private static lastHash: string = '';

  private static async getLatestHash(): Promise<string> {
    try {
      const content = await fs.readFile(this.AUDIT_CHAIN_PATH, 'utf-8');
      const lines = content.trim().split('\n');
      if (lines.length === 0) return '0'.repeat(64);
      const lastLine = lines[lines.length - 1];
      try {
        const entry = JSON.parse(lastLine);
        return entry.hash || '0'.repeat(64);
      } catch {
        return '0'.repeat(64);
      }
    } catch {
      return '0'.repeat(64);
    }
  }

  public static async appendToAuditChain(entry: any): Promise<void> {
    if (!this.lastHash) {
      this.lastHash = await this.getLatestHash();
    }
    const timestamp = new Date().toISOString();
    const dataToHash = JSON.stringify({ entry, prev: this.lastHash, timestamp });
    const newHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    const logLine = JSON.stringify({ timestamp, entry, prevHash: this.lastHash, hash: newHash }) + '\n';
    await fs.appendFile(this.AUDIT_CHAIN_PATH, logLine, 'utf-8');
    this.lastHash = newHash;
  }
}

// For functional style compatibility
export async function auditLog(entry: object): Promise<void> {
  await AuditChain.appendToAuditChain(entry);
}
