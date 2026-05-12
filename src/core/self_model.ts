import * as fs from 'fs';
import * as path from 'path';

export interface CapabilityStats {
  successes: number;
  failures: number;
}

export interface AffectiveState {
  confidence: number;
  urgency: number;
  trust: number;
  novelty: number;
}

export interface FailureRecord {
  domain: string;
  confidence: number;
  timestamp: number;
}

export class AgentSelfModel {
  public capabilities: Map<string, CapabilityStats> = new Map();
  public knownBiases: string[] = [];
  public affectiveState: AffectiveState = {
    confidence: 0.5,
    urgency: 0.0,
    trust: 0.5,
    novelty: 0.0
  };
  public recentFailures: FailureRecord[] = [];
  private totalEpisodes = 0;

  constructor() {
    this._loadState();
  }

  private _loadState() {
    // Logic for persistence could go here if needed
  }

  updateFromEpisode(domain: string, outcome: 'success' | 'failure', confidence: number): void {
    // Update capabilities map
    const stats = this.capabilities.get(domain) || { successes: 0, failures: 0 };
    if (outcome === 'success') {
      stats.successes++;
    } else {
      stats.failures++;
      this.recentFailures.push({ domain, confidence, timestamp: Date.now() });
      
      // If 5+ failures in same domain -> detect bias, add to knownBiases
      const domainFailures = this.recentFailures.filter(f => f.domain === domain).length;
      const biasLabel = `Low reliability in ${domain}`;
      if (domainFailures >= 5 && !this.knownBiases.includes(biasLabel)) {
        this.knownBiases.push(biasLabel);
      }
    }
    this.capabilities.set(domain, stats);

    // EMA on affective_state.confidence (alpha=0.3)
    const alpha = 0.3;
    const targetConfidence = outcome === 'success' ? 1.0 : 0.0;
    this.affectiveState.confidence = (1 - alpha) * this.affectiveState.confidence + alpha * targetConfidence;

    this.totalEpisodes++;
    if (this.totalEpisodes % 10 === 0) {
      this._regenerateNarrative();
    }
  }

  shouldEscalate(domain: string, confidence: number): boolean {
    const stats = this.capabilities.get(domain);
    const total = stats ? stats.successes + stats.failures : 0;
    const domainRate = total > 0 ? stats!.successes / total : 0.5;

    const combined = 0.6 * confidence + 0.4 * domainRate;
    return combined < 0.5;
  }

  getAffectiveContext(): AffectiveState {
    return { ...this.affectiveState };
  }

  private _regenerateNarrative(): void {
    let strongestDomain = 'None';
    let maxSuccess = -1;
    let table = '| Domain | Successes | Failures | Rate |\n| --- | --- | --- | --- |\n';

    for (const [domain, stats] of this.capabilities.entries()) {
      const total = stats.successes + stats.failures;
      const rate = total > 0 ? (stats.successes / total).toFixed(2) : '0.00';
      table += `| ${domain} | ${stats.successes} | ${stats.failures} | ${rate} |\n`;
      
      if (stats.successes > maxSuccess) {
        maxSuccess = stats.successes;
        strongestDomain = domain;
      }
    }

    const content = `# Agent Self-Model Narrative\n\n` +
      `**Strongest Domain:** ${strongestDomain}\n\n` +
      `## Domain Performance\n${table}\n` +
      `## Known Biases\n${this.knownBiases.length > 0 ? this.knownBiases.map(b => `- ${b}`).join('\n') : 'No known biases detected.'}\n\n` +
      `*Last updated: ${new Date().toISOString()}*`;

    try {
      fs.writeFileSync(path.join(process.cwd(), 'narrative.md'), content);
    } catch (e) {
      console.error('Failed to write narrative.md', e);
    }
  }
}
