import fs from 'node:fs';
import path from 'node:path';

export function parseRecentAuditLogs(hours: number): Record<string, any>[] {
  const auditPath = path.join(process.cwd(), 'audit.log');
  if (!fs.existsSync(auditPath)) return [];

  const now = Date.now();
  const msLimit = hours * 3600000;
  const content = fs.readFileSync(auditPath, 'utf-8');
  const lines = content.split('\n');
  const results: Record<string, any>[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.ts && now - new Date(entry.ts).getTime() < msLimit) {
        results.push(entry);
      }
    } catch (e) {
      // Ignore malformed JSON
    }
  }

  return results;
}
