import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const AUDIT_CHAIN_PATH = path.join(process.cwd(), 'swarm_log.md');

let lastHash: string = '';

async function getLatestHash(): Promise<string> {
  try {
    const content = await fs.readFile(AUDIT_CHAIN_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/HASH: ([a-f0-9]{64})/);
    return match ? match[1] : '';
  } catch {
    return '0'.repeat(64);
  }
}

export async function appendToAuditChain(entry: string): Promise<void> {
  if (!lastHash) lastHash = await getLatestHash();
  const timestamp = new Date().toISOString();
  const dataToHash = `${lastHash}|${timestamp}|${entry}`;
  const newHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  const logLine = `[${timestamp}] ${entry} | PREV: ${lastHash} | HASH: ${newHash}\n`;
  await fs.appendFile(AUDIT_CHAIN_PATH, logLine, 'utf-8');
  lastHash = newHash;
}
