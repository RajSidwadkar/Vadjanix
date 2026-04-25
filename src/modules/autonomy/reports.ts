import { parseRecentAuditLogs } from '../../security/audit_parser.js';
import { GoalTracker } from './goals.js';

export class ReportingEngine {
  private tracker = new GoalTracker();

  public buildDailyReport(): string {
    const logs = parseRecentAuditLogs(24);
    return this.generateReport('DAILY', logs);
  }

  public buildWeeklyReport(): string {
    const logs = parseRecentAuditLogs(168);
    return this.generateReport('WEEKLY', logs);
  }

  private generateReport(type: 'DAILY' | 'WEEKLY', logs: Record<string, any>[]): string {
    const l12 = logs.filter(l => l.level === 'L1' || l.level === 'L2').length;
    const l34 = logs.filter(l => l.level === 'L3' || l.level === 'L4').length;
    const rollbacks = logs.filter(l => l.type === 'rollback' || l.action === 'rollback').length;
    const goals = this.tracker.getPendingGoals();

    const typeLabel = type === 'DAILY' ? 'Daily' : 'Weekly';

    return `📊 Vadjanix ${typeLabel} Report
--------------------------------
Handled autonomously: ${l12}
Escalated to you: ${l34}
System Rollbacks: ${rollbacks}

Current Pending Goals:
${goals.map(g => `  • ${g}`).join('\n')}

Status: CAPSULE PROTOCOL SECURE. PHASE 2 COMPLETE.`;
  }
}
