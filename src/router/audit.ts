import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'security-audit.log');

/**
 * Logs a security event to a timestamped single-line log file.
 * Format: [TIMESTAMP] DROPPED | Reason: <reason> | Source: <source> | Payload: <payload>
 */
export function logSecurityEvent(reason: string, source: string, payload: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] DROPPED | Reason: ${reason} | Source: ${source} | Payload: ${payload}\n`;

  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to security-audit.log:', err);
  }
}
