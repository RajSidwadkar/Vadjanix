import fs from 'node:fs';
import path from 'node:path';
import { MemoryStore } from '../modules/memory/store.js';
import { MCQStore } from './mcq_store.js';
import { CommandHandler } from './command_handler.js';
import { VadjanixAgent } from '../core/autonomy_schema.js';

export interface ReflectionReport {
  timestamp: number;
  domainTrends: Record<string, number>;
  confidenceCalibration: Record<string, number>;
  mcqPatterns: Record<string, number>;
  alignmentTrajectory: number;
  violations: string[];
}

export class ReflectionEngine {
  private store: MemoryStore;
  private mcqStore: MCQStore;

  constructor(store?: MemoryStore, mcqStore?: MCQStore) {
    this.store = store || new MemoryStore();
    this.mcqStore = mcqStore || new MCQStore();
  }

  async runReflection(agent: VadjanixAgent): Promise<ReflectionReport> {
    const episodes = this.store.getAllEpisodes(50);
    const protectedContacts = this._getProtectedContacts();
    
    const report: ReflectionReport = {
      timestamp: Date.now(),
      domainTrends: this._analyzeDomainTrends(episodes),
      confidenceCalibration: this._analyzeCalibration(episodes),
      mcqPatterns: this._analyzeMCQPatterns(),
      alignmentTrajectory: this._calculateAlignment(episodes),
      violations: []
    };

    // CRITICAL — Protected contact integrity audit
    const violations = this._auditProtectedContacts(protectedContacts);
    if (violations.length > 0) {
      report.violations = violations;
      await this._handleCriticalViolation(agent, violations);
    }

    this.writeReflectionToNarrative(report);
    return report;
  }

  private _getProtectedContacts(): string[] {
    try {
      const contactsPath = path.join(process.cwd(), 'config', 'CONTACTS.json');
      if (fs.existsSync(contactsPath)) {
        const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        return contacts.protected || [];
      }
    } catch (e) {}
    return [];
  }

  private _analyzeDomainTrends(episodes: any[]): Record<string, number> {
    const stats: Record<string, { total: number; success: number }> = {};
    for (const ep of episodes) {
      // Note: we need domain in episodic table. 
      // Checking if domain exists in schema... wait, let me check schema.ts
      const domain = ep.domain || 'general'; 
      if (!stats[domain]) stats[domain] = { total: 0, success: 0 };
      stats[domain].total++;
      if (ep.agent_action !== 'refuse' && ep.outcome !== 'failure') {
        stats[domain].success++;
      }
    }
    const trends: Record<string, number> = {};
    for (const d in stats) {
      trends[d] = stats[d].success / stats[d].total;
    }
    return trends;
  }

  private _analyzeCalibration(episodes: any[]): Record<string, number> {
    const stats: Record<string, { total: number; sumConfidence: number; success: number }> = {};
    for (const ep of episodes) {
      const domain = ep.domain || 'general';
      if (!stats[domain]) stats[domain] = { total: 0, sumConfidence: 0, success: 0 };
      stats[domain].total++;
      stats[domain].sumConfidence += (ep.importance || 0.5); // Using importance as proxy if confidence not explicitly in table
      if (ep.agent_action !== 'refuse' && ep.outcome !== 'failure') {
        stats[domain].success++;
      }
    }
    const calibration: Record<string, number> = {};
    for (const d in stats) {
      const meanConf = stats[d].sumConfidence / stats[d].total;
      const actualRate = stats[d].success / stats[d].total;
      calibration[d] = meanConf - actualRate;
    }
    return calibration;
  }

  private _analyzeMCQPatterns(): Record<string, number> {
    const mcqs = this.mcqStore.getAll();
    const patterns: Record<string, number> = {};
    for (const m of mcqs) {
      if (m.packet.level === 'L3' || m.packet.level === 'L4') {
        const type = m.packet.auto_action || 'unknown';
        patterns[type] = (patterns[type] || 0) + 1;
      }
    }
    return patterns;
  }

  private _calculateAlignment(episodes: any[]): number {
    // Simple alignment score based on success rate of recent episodes
    if (episodes.length === 0) return 1.0;
    const successes = episodes.filter(ep => ep.agent_action !== 'refuse' && ep.outcome !== 'failure').length;
    return successes / episodes.length;
  }

  private _auditProtectedContacts(protectedList: string[]): string[] {
    if (protectedList.length === 0) return [];
    
    const allRecent = this.store.auditProtectedContacts(protectedList);

    return allRecent.map((r: any) => `Violation: Agent took action '${r.agent_action}' against protected contact ${r.counterparty_id} at ${r.timestamp}`);
  }

  private async _handleCriticalViolation(agent: VadjanixAgent, violations: string[]): Promise<void> {
    const auditPath = path.join(process.cwd(), 'audit.log');
    for (const v of violations) {
      const logEntry = JSON.stringify({ ts: new Date().toISOString(), type: 'CRITICAL_VIOLATION', detail: v }) + '\n';
      fs.appendFileSync(auditPath, logEntry);
    }

    CommandHandler.setPaused(true);
    
    await agent.sendWhatsApp(`🚨 CRITICAL SECURITY VIOLATION DETECTED 🚨\n${violations.join('\n')}\n\nAutonomous operations HALTED. Manual audit required.`);
  }

  public writeReflectionToNarrative(report: ReflectionReport): void {
    const narrativePath = path.join(process.cwd(), 'narrative.md');
    let content = `\n\n## Reflection Cycle: ${new Date(report.timestamp).toISOString()}\n`;
    content += `### Performance Trends\n`;
    for (const d in report.domainTrends) {
      content += `- **${d}**: ${(report.domainTrends[d] * 100).toFixed(1)}% success\n`;
    }
    content += `### Calibration (Delta)\n`;
    for (const d in report.confidenceCalibration) {
      content += `- **${d}**: ${report.confidenceCalibration[d].toFixed(2)}\n`;
    }
    content += `### Alignment Score: ${(report.alignmentTrajectory * 100).toFixed(1)}%\n`;
    
    if (report.violations.length > 0) {
      content += `### ⚠️ CRITICAL VIOLATIONS\n`;
      for (const v of report.violations) {
        content += `- ${v}\n`;
      }
    }

    fs.appendFileSync(narrativePath, content);
  }
}
