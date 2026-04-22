import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class AuditChain {
  private static readonly AUDIT_CHAIN_PATH = path.join(process.cwd(), 'swarm_log.md');
  private static lastHash: string = '';

  private static async getLatestHash(): Promise<string> {
    try {
      const content = await fs.readFile(this.AUDIT_CHAIN_PATH, 'utf-8');
      const lines = content.trim().split('\n');
      if (lines.length === 0) return '0'.repeat(64);
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/HASH: ([a-f0-9]{64})/);
      return match ? match[1] : '0'.repeat(64);
    } catch {
      return '0'.repeat(64);
    }
  }

  public static async appendToAuditChain(entry: string): Promise<void> {
    if (!this.lastHash) {
      this.lastHash = await this.getLatestHash();
    }
    const timestamp = new Date().toISOString();
    const dataToHash = `${this.lastHash}|${timestamp}|${entry}`;
    const newHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    const logLine = `[${timestamp}] ${entry} | PREV: ${this.lastHash} | HASH: ${newHash}\n`;
    await fs.appendFile(this.AUDIT_CHAIN_PATH, logLine, 'utf-8');
    this.lastHash = newHash;
  }
}
