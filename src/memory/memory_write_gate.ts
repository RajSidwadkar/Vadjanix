import { appendToAuditChain } from './audit_chain.js';

export async function gateMemoryWrite(
  data: string, 
  sourceTag: string, 
  trustScore: number
): Promise<boolean> {
  if (trustScore < 0.3) {
    await appendToAuditChain(`REJECTED_MEMORY: low trust score (${trustScore}) from ${sourceTag}`);
    return false;
  }
  
  if (!sourceTag || sourceTag.trim().length === 0) {
    await appendToAuditChain(`REJECTED_MEMORY: missing source_tag`);
    return false;
  }

  return true;
}
