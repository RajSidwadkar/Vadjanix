import fs from 'fs/promises';
import path from 'path';

/**
 * Logs a human-readable reasoning trail for the agent's decisions.
 * This operation is asynchronous and uses non-blocking I/O.
 * 
 * @param action The high-level action being performed (e.g., 'propose', 'refuse').
 * @param context The input or situation that triggered the decision.
 * @param ruleApplied The specific principle or rule from the constitution being used.
 * @param decision The final outcome or output of the logic.
 */
export async function logDecision(
  action: string,
  context: string,
  ruleApplied: string,
  decision: string
): Promise<void> {
  const logPath = path.join(process.cwd(), 'audit_log.md');
  const timestamp = new Date().toISOString();
  
  const entry = `[${timestamp}] ACTION: ${action} | CONTEXT: ${context} | RULE: ${ruleApplied} | DECISION: ${decision}\n`;

  try {
    // fs.promises.appendFile is non-blocking for the event loop
    await fs.appendFile(logPath, entry, 'utf-8');
  } catch (error) {
    console.error(`[AUDIT ERROR] Failed to write to audit log: ${error}`);
  }
}
