import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import { VadjanixAgent } from '../../core/autonomy_schema.js';
import { ReportingEngine } from './reports.js';

export class HeartbeatManager {
  private reports: ReportingEngine;

  constructor() {
    this.reports = new ReportingEngine();
  }

  private auditLog(entry: Record<string, unknown>): void {
    const auditPath = path.join(process.cwd(), 'audit.log');
    const logLine = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(auditPath, logLine, 'utf-8');
  }

  public start(agent: VadjanixAgent): void {
    cron.schedule('*/15 * * * *', async () => {
      try {
        await agent.processEventQueue();
        await agent.checkGoalsProgress();
        await agent.runAutonomousActions();
      } catch (error) {
        this.auditLog({ type: 'HEARTBEAT_ERROR', task: '15min_cycle', error: error instanceof Error ? error.message : String(error) });
      }
    });

    cron.schedule('0 7 * * *', async () => {
      try {
        const report = this.reports.buildDailyReport();
        await agent.sendWhatsApp(report);
      } catch (error) {
        this.auditLog({ type: 'HEARTBEAT_ERROR', task: 'daily_report', error: error instanceof Error ? error.message : String(error) });
      }
    });

    cron.schedule('0 18 * * 0', async () => {
      try {
        const report = this.reports.buildWeeklyReport();
        await agent.sendWhatsApp(report);
      } catch (error) {
        this.auditLog({ type: 'HEARTBEAT_ERROR', task: 'weekly_report', error: error instanceof Error ? error.message : String(error) });
      }
    });
  }
}
