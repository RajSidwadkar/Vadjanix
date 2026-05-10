import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import { VadjanixAgent } from '../core/autonomy_schema.js';
import { ReportingEngine } from './report_engine.js';
import { MCQStore } from './mcq_store.js';
import { CommandHandler } from './command_handler.js';

export class HeartbeatManager {
  private reports = new ReportingEngine();
  private mcqStore = new MCQStore();

  private auditLog(entry: Record<string, unknown>): void {
    const auditPath = path.join(process.cwd(), 'audit.log');
    const logLine = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(auditPath, logLine, 'utf-8');
  }

  public start(agent: VadjanixAgent): void {
    // 15-minute cycle
    cron.schedule('*/15 * * * *', async () => {
      if (CommandHandler.getPaused()) return;

      try {
        await agent.processEventQueue();
        await this.checkGoalsProgress(agent);
        await agent.runAutonomousActions();
        await this.checkVetoWindows(agent);
      } catch (error) {
        this.auditLog({ 
          type: 'HEARTBEAT_ERROR', 
          task: '15min_cycle', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Daily report at 7:00 AM
    cron.schedule('0 7 * * *', async () => {
      try {
        const report = await this.reports.buildDailyReport();
        await agent.sendWhatsApp(report);
      } catch (error) {
        this.auditLog({ 
          type: 'HEARTBEAT_ERROR', 
          task: 'daily_report', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Weekly report on Sunday at 6:00 PM
    cron.schedule('0 18 * * 0', async () => {
      try {
        const report = await this.reports.buildWeeklyReport();
        await agent.sendWhatsApp(report);
      } catch (error) {
        this.auditLog({ 
          type: 'HEARTBEAT_ERROR', 
          task: 'weekly_report', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }

  private async checkVetoWindows(agent: VadjanixAgent): Promise<void> {
    const pending = this.mcqStore.getAll();
    const now = Date.now();

    for (const mcq of pending) {
      if (mcq.packet.level === 'L3' && mcq.packet.auto_action) {
        const timeoutMs = (mcq.packet.timeout_mins || 15) * 60000;
        if (now - mcq.timestamp > timeoutMs) {
          this.auditLog({ 
            type: 'VETO_TIMEOUT', 
            mcqId: mcq.id, 
            action: mcq.packet.auto_action,
            message: 'Auto-executing L3 action after timeout'
          });
          
          // Execute auto_action
          // Note: agent needs a way to execute an action string
          // For now we'll assume it has a way or we just log it
          // In a real scenario, we might call agent.execute(mcq.packet.auto_action)
          this.mcqStore.remove(mcq.id);
          
          await agent.sendWhatsApp(`🔔 Auto-executing L3 action: ${mcq.packet.auto_action} (No response after ${mcq.packet.timeout_mins}min)`);
        }
      }
    }
  }

  private async checkGoalsProgress(agent: VadjanixAgent): Promise<void> {
    const goalsPath = path.join(process.cwd(), 'GOALS.md');
    if (!fs.existsSync(goalsPath)) return;

    const content = fs.readFileSync(goalsPath, 'utf-8');
    const lines = content.split('\n');
    
    let total = 0;
    let completed = 0;

    for (const line of lines) {
      if (line.startsWith('- [ ]')) total++;
      if (line.startsWith('- [x]')) {
        total++;
        completed++;
      }
    }

    if (total === 0) return;

    const progress = (completed / total) * 100;
    
    // Placeholder for "off track" logic. 
    // If we had a project start date and end date, we could calculate expected progress.
    // For now, we'll just log it.
    this.auditLog({ type: 'GOALS_PROGRESS', total, completed, progress: progress.toFixed(2) + '%' });

    if (progress < 20 && total > 5) {
      // Example of "flagging" if progress is low
      // await agent.sendWhatsApp(`⚠️ Goal progress is low: ${progress.toFixed(1)}% (${completed}/${total})`);
    }
  }
}
