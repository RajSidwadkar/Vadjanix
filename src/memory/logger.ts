import fs from 'fs/promises';
import path from 'path';

export async function logDeal(
  counterparty: string,
  amount: string,
  result: 'Accepted' | 'Refused',
  reasoning: string
) {
  const memoryDir = path.join(process.cwd(), 'memory');
  const dealsPath = path.join(memoryDir, 'deals.md');
  const timestamp = new Date().toISOString();

  const tableHeader = `| Timestamp | Counterparty | Amount | Result | Reasoning |\n|---|---|---|---|---|\n`;
  const row = `| ${timestamp} | ${counterparty} | ${amount} | ${result} | ${reasoning} |\n`;

  try {
    await fs.mkdir(memoryDir, { recursive: true });
    
    let fileExists = true;
    try {
      await fs.access(dealsPath);
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      await fs.writeFile(dealsPath, tableHeader + row, 'utf-8');
    } else {
      await fs.appendFile(dealsPath, row, 'utf-8');
    }
  } catch (error) {
    console.error("❌ Deal Logging Failed:", error);
  }
}
