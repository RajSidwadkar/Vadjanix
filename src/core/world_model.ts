import { createHash } from 'node:crypto';

export interface State {
  rawObs: unknown;
  stateHash: string;
  visited: boolean;
  reward: number;
}

export function hashState(obs: unknown): string {
  const str = JSON.stringify(obs);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export interface Transition {
  nextHash: string;
  reward: number;
  frequency: number;
}

export interface Hypothesis {
  action: string;
  condition: string;
  effect: string;
  confidence: number;
  evidenceCount: number;
  tested?: boolean;
}

export class WorldModel {
  // stateHash -> action -> Transition
  public transitions: Map<string, Map<string, Transition>> = new Map();
  public hypotheses: Hypothesis[] = [];
  public goalCandidates: State[] = [];
  public mechanics: Record<string, string> = {};

  public update(state: State, action: string, nextState: State, reward: number): void {
    let stateTransitions = this.transitions.get(state.stateHash);
    if (!stateTransitions) {
      stateTransitions = new Map();
      this.transitions.set(state.stateHash, stateTransitions);
    }

    const existing = stateTransitions.get(action);
    if (existing) {
      // Running average reward: (old_avg * freq + new_reward) / (freq + 1)
      const newFreq = existing.frequency + 1;
      existing.reward = (existing.reward * existing.frequency + reward) / newFreq;
      existing.frequency = newFreq;
      existing.nextHash = nextState.stateHash;
    } else {
      stateTransitions.set(action, {
        nextHash: nextState.stateHash,
        reward: reward,
        frequency: 1
      });
    }

    if (reward > 0) {
      const exists = this.goalCandidates.some(s => s.stateHash === nextState.stateHash);
      if (!exists) {
        this.goalCandidates.push({ ...nextState, visited: true, reward: reward });
        // Keep top 10 goal candidates by reward
        this.goalCandidates.sort((a, b) => b.reward - a.reward);
        if (this.goalCandidates.length > 10) {
          this.goalCandidates.pop();
        }
      }
    }

    this._updateHypotheses(state, action, nextState, reward);
  }

  public predict(state: State, action: string): Transition | undefined {
    return this.transitions.get(state.stateHash)?.get(action);
  }

  public getBestUnexploredAction(state: State, actions: string[]): string {
    const stateTransitions = this.transitions.get(state.stateHash);
    
    // 1. Unexplored actions
    const unexplored = actions.filter(a => !stateTransitions || !stateTransitions.has(a));
    if (unexplored.length > 0) {
      return unexplored[Math.floor(Math.random() * unexplored.length)];
    }

    // 2. All explored -> pick max expected reward
    if (stateTransitions) {
      let bestAction = actions[0];
      let maxReward = -Infinity;

      for (const action of actions) {
        const trans = stateTransitions.get(action);
        if (trans && trans.reward > maxReward) {
          maxReward = trans.reward;
          bestAction = action;
        }
      }
      return bestAction;
    }

    // 3. No data -> pick random
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private _updateHypotheses(state: State, action: string, nextState: State, reward: number): void {
    if (reward <= 0) return;

    const existingIndex = this.hypotheses.findIndex(h => h.action === action);
    if (existingIndex === -1) {
      // Add new hypothesis
      this.hypotheses.push({
        action,
        condition: `state === ${state.stateHash}`,
        effect: `reward += ${reward}`,
        confidence: 0.5,
        evidenceCount: 1,
        tested: false
      });
    } else {
      // Increment confidence
      const h = this.hypotheses[existingIndex];
      h.confidence = Math.min(1.0, h.confidence + 0.1);
      h.evidenceCount++;
    }

    // Sort by confidence
    this.hypotheses.sort((a, b) => b.confidence - a.confidence);
  }

  public toSummary(): string {
    const knownTransitionsCount = Array.from(this.transitions.values())
      .reduce((sum, m) => sum + m.size, 0);

    const summary = {
      knownTransitions: knownTransitionsCount,
      hypotheses: this.hypotheses.slice(0, 5).map(h => ({
        a: h.action,
        c: h.confidence.toFixed(2),
        e: h.evidenceCount
      })),
      goalCandidates: this.goalCandidates.slice(0, 3).map(s => s.stateHash),
      mechanics: this.mechanics
    };

    return JSON.stringify(summary);
  }
}
