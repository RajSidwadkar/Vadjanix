import crypto from 'node:crypto';
import fs from 'node:fs';

const LOG_FILE = 'audit.log';

export function auditLog(entry: object): void {
  let prevHash = '0'.repeat(64);
  
  if (fs.existsSync(LOG_FILE)) {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    if (lines.length > 0) {
      try {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        prevHash = lastEntry.hash;
      } catch (e) {
        // Fallback if file is corrupted
      }
    }
  }

  const timestamp = new Date().toISOString();
  const dataToHash = JSON.stringify({ ...entry, prevHash, timestamp });
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  
  const record = JSON.stringify({ ...entry, prevHash, timestamp, hash }) + '\n';
  fs.appendFileSync(LOG_FILE, record);
}
