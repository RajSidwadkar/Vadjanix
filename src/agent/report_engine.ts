import { parseRecentAuditLogs } from '../security/audit_parser.js';
import { GoalTracker } from '../modules/autonomy/goals.js';

export class ReportingEngine {
  private tracker = new GoalTracker();

  public async buildDailyReport(): Promise<string> {
    const logs = parseRecentAuditLogs(24);
    return this.generateReport('Daily', logs);
  }

  public async buildWeeklyReport(): Promise<string> {
    const logs = parseRecentAuditLogs(168);
    return this.generateReport('Weekly', logs);
  }

  private generateReport(type: 'Daily' | 'Weekly', logs: Record<string, any>[]): string {
    const dateStr = new Date().toLocaleDateString();
    
    // Filter by autonomy level
    const autonomous = logs.filter(l => l.level === 'L1' || l.level === 'L2').length;
    const escalated = logs.filter(l => l.level === 'L3' || l.level === 'L4').length;
    const rollbacks = logs.filter(l => l.type === 'rollback' || l.action === 'rollback').length;
    
    // Extract top actions (up to 3)
    const actions = logs
      .filter(l => l.action_description || l.message)
      .slice(-3)
      .map(l => l.action_description || l.message);

    const pending = this.tracker.getPendingGoals().slice(0, 3);

    return `📊 Vadjanix ${type} Report — ${dateStr}
✅ Handled autonomously: ${autonomous}
🔔 Escalated to you: ${escalated}
↩️ Rollbacks: ${rollbacks}

Top actions:
${actions.length > 0 ? actions.map(a => `• ${a}`).join('\n') : 'None'}

Pending:
${pending.length > 0 ? pending.map(p => `• ${p}`).join('\n') : 'No pending goals'}

Reply: status | undo | pause | goals | report | help`;
  }
}
