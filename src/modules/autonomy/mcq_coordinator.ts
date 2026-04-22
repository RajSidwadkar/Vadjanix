import { MCQPacket } from '../../core/mcq_schema.js';

export class MCQCoordinator {
  private pendingMCQs: Map<string, NodeJS.Timeout> = new Map();

  public dispatchMCQ(
    packet: MCQPacket,
    onExecute: (action: string) => Promise<void>
  ): string {
    const mcqId = `mcq_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    if (packet.level === 'L3' && packet.auto_action && packet.timeout_mins > 0) {
      const timer = setTimeout(async () => {
        if (this.pendingMCQs.has(mcqId)) {
          this.pendingMCQs.delete(mcqId);
          await onExecute(packet.auto_action!);
        }
      }, packet.timeout_mins * 60000);
      this.pendingMCQs.set(mcqId, timer);
    }

    return mcqId;
  }

  public async resolveMCQ(
    mcqId: string,
    selectedOptionKey: string,
    packet: MCQPacket,
    onExecute: (action: string) => Promise<void>
  ): Promise<boolean> {
    const timer = this.pendingMCQs.get(mcqId);
    if (timer) {
      clearTimeout(timer);
      this.pendingMCQs.delete(mcqId);
    }

    const action = packet.options[selectedOptionKey];
    if (action) {
      await onExecute(action);
      return true;
    }
    return false;
  }
}
