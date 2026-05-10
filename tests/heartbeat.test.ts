import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportingEngine } from '../src/agent/report_engine.js';
import * as auditParser from '../src/security/audit_parser.js';
import { GoalTracker } from '../src/modules/autonomy/goals.js';

vi.mock('../src/security/audit_parser.js');
vi.mock('../src/modules/autonomy/goals.js');

describe('ReportingEngine', () => {
  let engine: ReportingEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ReportingEngine();
  });

  it('buildDailyReport returns correctly formatted string', async () => {
    const mockLogs = [
      { ts: new Date().toISOString(), level: 'L1', action_description: 'Auto-task 1' },
      { ts: new Date().toISOString(), level: 'L3', message: 'Escalated task' },
      { ts: new Date().toISOString(), type: 'rollback', message: 'Rollback action' }
    ];

    vi.mocked(auditParser.parseRecentAuditLogs).mockReturnValue(mockLogs);
    vi.mocked(GoalTracker.prototype.getPendingGoals).mockReturnValue(['Finish implementation']);

    const report = await engine.buildDailyReport();

    expect(report).toContain('📊 Vadjanix Daily Report');
    expect(report).toContain('✅ Handled autonomously: 1');
    expect(report).toContain('🔔 Escalated to you: 1');
    expect(report).toContain('↩️ Rollbacks: 1');
    expect(report).toContain('• Auto-task 1');
    expect(report).toContain('• Finish implementation');
    expect(report).toContain('Reply: status | undo | pause | goals | report | help');
  });
});
