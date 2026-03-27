import fs from 'fs/promises';
import path from 'path';

/**
 * Logs a swarm execution to swarm_log.md in the project root.
 */
export async function logSwarmRun(
  goal: string, 
  strategy: string, 
  agentsTotal: string[], 
  agentsSuccess: string[], 
  agentsTimeout: string[], 
  finalResult: string, 
  latencyMs: number
) {
  const logPath = path.join(process.cwd(), 'swarm_log.md');
  const timestamp = new Date().toISOString();
  
  const successList = agentsSuccess.length > 0 ? agentsSuccess.join(', ') : "None";
  const timeoutList = agentsTimeout.length > 0 ? agentsTimeout.join(', ') : "None";

  const entry = `
[${timestamp}]
Goal: ${goal}
Strategy: ${strategy}
Latency: ${latencyMs}ms
Sub-Agents (${agentsTotal.length}):

Success: ${successList}

Timed Out: ${timeoutList}
Final Result: ${finalResult}
---
`;

  try {
    await fs.appendFile(logPath, entry, 'utf-8');
  } catch (error: any) {
    console.error(`[MEMORY ERROR] Failed to write to swarm_log.md: ${error.message}`);
  }
}
