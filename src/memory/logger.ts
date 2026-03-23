import { mkdir, appendFile, access, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const MEMORY_DIR = 'memory';
const CONTEXT_LOG_PATH = join(MEMORY_DIR, 'context_log.md');
const DEALS_PATH = join(MEMORY_DIR, 'deals.md');

async function ensureDirectory() {
    try {
        await mkdir(MEMORY_DIR, { recursive: true });
    } catch (error) {
        // Directory already exists or error
    }
}

async function ensureFile(path: string, initialContent: string = '') {
    try {
        await access(path);
    } catch {
        await writeFile(path, initialContent);
    }
}

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Appends a session transcript to context_log.md.
 */
export async function appendContext(
    counterparty: string,
    userMessage: string,
    agentAction: string,
    agentResponse: string
) {
    await ensureDirectory();
    await ensureFile(CONTEXT_LOG_PATH);

    const timestamp = getTimestamp();
    const entry = `\n## [${timestamp}] - Session with [${counterparty}]\n` +
                  `**Them:** ${userMessage}\n` +
                  `**Agent:** ${agentAction} / ${agentResponse}\n`;

    await appendFile(CONTEXT_LOG_PATH, entry);
}

/**
 * Logs a deal to deals.md as a Markdown table row.
 */
export async function logDeal(
    counterparty: string,
    amount: string,
    result: 'Pending' | 'Accepted' | 'Refused',
    reasoning: string
) {
    await ensureDirectory();
    const header = '| Timestamp | Counterparty | Amount/Offer | Result (Pending/Accepted/Refused) | Reasoning |\n' +
                   '| :--- | :--- | :--- | :--- | :--- |\n';
    await ensureFile(DEALS_PATH, header);

    const timestamp = getTimestamp();
    const row = `| ${timestamp} | ${counterparty} | ${amount} | ${result} | ${reasoning} |\n`;

    await appendFile(DEALS_PATH, row);
}
