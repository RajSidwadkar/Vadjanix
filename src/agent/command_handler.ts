import { CapsuleManager } from './capsule.js';
import { GoalTracker } from '../modules/autonomy/goals.js';
import { ReportingEngine } from './report_engine.js';

export class CommandHandler {
  private capsuleManager = new CapsuleManager();
  private goalTracker = new GoalTracker();
  private reportingEngine = new ReportingEngine();
  private static isPaused = false;

  public static getPaused(): boolean {
    return this.isPaused;
  }

  public async handleOwnerCommand(text: string): Promise<string> {
    const args = text.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'status':
        return `Vadjanix Status: ${CommandHandler.isPaused ? 'PAUSED' : 'ACTIVE'}\nCapsule Protocol: SECURE\nSystem Time: ${new Date().toISOString()}`;
      
      case 'undo':
        try {
          const capsuleId = args[1];
          const result = await this.capsuleManager.rollback(capsuleId);
          return `↩️ Rollback successful: ${result.restored}\nSystem state restored.`;
        } catch (error) {
          return `❌ Rollback failed: ${error instanceof Error ? error.message : String(error)}`;
        }

      case 'pause':
        CommandHandler.isPaused = true;
        return '⏸️ Global pause activated. Heartbeat cycles will skip autonomous actions.';

      case 'resume':
        CommandHandler.isPaused = false;
        return '▶️ System resumed. Heartbeat cycles active.';

      case 'goals':
        const pending = this.goalTracker.getPendingGoals();
        return `🎯 Pending Goals:\n${pending.length > 0 ? pending.map(g => `• ${g}`).join('\n') : 'No pending goals.'}`;

      case 'report':
        return await this.reportingEngine.buildDailyReport();

      case 'help':
        return `Vadjanix Commands:
• status - Check system health
• undo [id] - Rollback to previous state
• pause - Stop autonomous actions
• resume - Restart autonomous actions
• goals - List pending objectives
• report - Generate daily report`;

      default:
        return `Unknown command: ${cmd}. Type 'help' for available commands.`;
    }
  }
}
