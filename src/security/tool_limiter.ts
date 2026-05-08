export class ToolLimiter {
  private callCounts: Map<string, number> = new Map();

  checkAndIncrement(sessionId: string): boolean {
    const currentCount = this.callCounts.get(sessionId) || 0;
    if (currentCount >= 20) {
      return false;
    }
    this.callCounts.set(sessionId, currentCount + 1);
    return true;
  }

  validateSchema(toolCall: any): boolean {
    if (typeof toolCall !== 'object' || toolCall === null) return false;
    if (typeof toolCall.tool !== 'string') return false;
    if (typeof toolCall.args !== 'object' || toolCall.args === null) return false;
    return true;
  }
}
