import { WorldModel, State, hashState } from './world_model.js';
import { GhostSandbox } from '../agent/ghost_sandbox.js';

export type AgentPhase = 'EXPLORE' | 'HYPOTHESIZE' | 'VERIFY' | 'PLAN' | 'EXECUTE';

export class VadjanixARC3Agent {
  public worldModel: WorldModel;
  public sandbox: GhostSandbox;
  public stateGraph: Map<string, State> = new Map();
  public currentState: State | null = null;
  public goalState: State | null = null;
  public actionHistory: string[] = [];
  public phase: AgentPhase = 'EXPLORE';
  public efficiencyBudget = 1000;
  public actionsTaken = 0;
  private _executionPlan: string[] = [];
  private _lastAction: string | null = null;
  private _verifiedHypothesesCount = 0;

  constructor(public agentName: string) {
    this.worldModel = new WorldModel();
    this.sandbox = new GhostSandbox();
  }

  public step(observation: unknown, availableActions: string[], reward: number): string {
    this.actionsTaken++;
    const h = hashState(observation);
    const newState: State = {
      rawObs: observation,
      stateHash: h,
      visited: true,
      reward: reward
    };

    if (this.currentState && this._lastAction) {
      this.worldModel.update(this.currentState, this._lastAction, newState, reward);
    }

    // High reward target identified
    if (reward > 0.5 && !this.goalState) {
      this.goalState = newState;
      this.phase = 'PLAN';
    }

    this.currentState = newState;
    this.stateGraph.set(h, newState);

    let action: string;
    switch (this.phase) {
      case 'EXPLORE':
        action = this._explore(newState, availableActions);
        break;
      case 'HYPOTHESIZE':
      case 'VERIFY':
        action = this._hypothesizeAndVerify(newState, availableActions);
        break;
      case 'PLAN':
        action = this._planAndExecute(newState, availableActions);
        break;
      case 'EXECUTE':
        action = this._executePlan(newState, availableActions);
        break;
      default:
        action = this._explore(newState, availableActions);
    }

    this._lastAction = action;
    this.actionHistory.push(action);
    if (this.actionHistory.length > 1000) {
      this.actionHistory.shift();
    }

    return action;
  }

  private _explore(state: State, actions: string[]): string {
    state.visited = true;
    if (this.stateGraph.size > 20 && this.worldModel.hypotheses.length > 3) {
      this.phase = 'HYPOTHESIZE';
    }
    return this.worldModel.getBestUnexploredAction(state, actions);
  }

  private _hypothesizeAndVerify(state: State, actions: string[]): string {
    // Find untested hypothesis with confidence > 0.6
    const hypothesis = this.worldModel.hypotheses.find(h => !h.tested && h.confidence > 0.6);
    
    if (hypothesis && actions.includes(hypothesis.action)) {
      hypothesis.tested = true;
      this._verifiedHypothesesCount++;
      
      if (this._verifiedHypothesesCount >= 3) {
        this.phase = 'PLAN';
      }
      return hypothesis.action;
    }

    // Fallback to explore
    return this.worldModel.getBestUnexploredAction(state, actions);
  }

  private _planAndExecute(state: State, actions: string[]): string {
    if (!this.goalState) {
      this.phase = 'EXPLORE';
      return this._explore(state, actions);
    }

    const path = this._bfsToGoal(state.stateHash, this.goalState.stateHash);
    if (path.length > 0) {
      this.phase = 'EXECUTE';
      this._executionPlan = path;
      const nextAction = this._executionPlan.shift()!;
      return nextAction;
    } else {
      this.phase = 'EXPLORE';
      return this._explore(state, actions);
    }
  }

  private _executePlan(state: State, actions: string[]): string {
    if (this._executionPlan.length === 0) {
      this.phase = 'EXPLORE';
      return this._explore(state, actions);
    }

    const nextAction = this._executionPlan.shift()!;
    if (!actions.includes(nextAction)) {
      // unexpected state, replan
      this.phase = 'PLAN';
      return this._planAndExecute(state, actions);
    }

    return nextAction;
  }

  public _bfsToGoal(startHash: string, goalHash: string): string[] {
    if (startHash === goalHash) return [];

    const queue: Array<{ hash: string; path: string[] }> = [{ hash: startHash, path: [] }];
    const visited = new Set<string>();
    visited.add(startHash);

    while (queue.length > 0) {
      const { hash, path } = queue.shift()!;

      const stateTransitions = this.worldModel.transitions.get(hash);
      if (stateTransitions) {
        for (const [action, transition] of stateTransitions.entries()) {
          if (transition.nextHash === goalHash) {
            return [...path, action];
          }
          if (!visited.has(transition.nextHash)) {
            visited.add(transition.nextHash);
            queue.push({
              hash: transition.nextHash,
              path: [...path, action]
            });
          }
        }
      }
    }

    return [];
  }

  public getEfficiencyScore(humanBaseline: number): number {
    return this.actionsTaken / Math.max(humanBaseline, 1);
  }
}
