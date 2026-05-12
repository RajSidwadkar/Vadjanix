import { AuditChain } from './audit_chain.js';

export class MemoryWriteGate {
  public static async gateMemoryWrite(
    data: string,
    sourceTag: string,
    trustScore: number
  ): Promise<boolean> {
    if (trustScore < 0.3) {
      await AuditChain.appendToAuditChain(`REJECTED_MEMORY: low trust score (${trustScore}) from ${sourceTag}`);
      return false;
    }

    if (!sourceTag || sourceTag.trim().length === 0) {
      await AuditChain.appendToAuditChain(`REJECTED_MEMORY: missing source_tag`);
      return false;
    }

    return true;
  }
}

// For functional style compatibility
export function trustGate(content: string, trustScore: number): boolean {
  return trustScore >= 0.3;
}
