import { describe, it, expect, beforeEach } from 'vitest';
import { WorldModel, hashState, State } from '../src/core/world_model.js';

describe('WorldModel', () => {
  let wm: WorldModel;
  let state1: State;
  let state2: State;

  beforeEach(() => {
    wm = new WorldModel();
    const obs1 = { room: 'hallway' };
    const obs2 = { room: 'kitchen' };
    state1 = { rawObs: obs1, stateHash: hashState(obs1), visited: true, reward: 0 };
    state2 = { rawObs: obs2, stateHash: hashState(obs2), visited: true, reward: 10 };
  });

  it('update() creates transitions correctly', () => {
    wm.update(state1, 'move_north', state2, 10);
    const trans = wm.predict(state1, 'move_north');
    expect(trans).toBeDefined();
    expect(trans?.nextHash).toBe(state2.stateHash);
    expect(trans?.reward).toBe(10);
    expect(trans?.frequency).toBe(1);
  });

  it('getBestUnexploredAction() returns unexplored action first', () => {
    const actions = ['north', 'south', 'east'];
    wm.update(state1, 'north', state2, 0);
    
    // north is explored, south and east are not.
    const best = wm.getBestUnexploredAction(state1, actions);
    expect(['south', 'east']).toContain(best);
  });

  it('hypothesis confidence increments on repeated positive reward', () => {
    wm.update(state1, 'search', state2, 10);
    expect(wm.hypotheses.length).toBe(1);
    expect(wm.hypotheses[0].confidence).toBe(0.5);

    wm.update(state1, 'search', state2, 5);
    expect(wm.hypotheses[0].confidence).toBe(0.6);
    expect(wm.hypotheses[0].evidenceCount).toBe(2);
  });

  it('toSummary() returns a concise JSON string', () => {
    wm.update(state1, 'search', state2, 10);
    const summary = JSON.parse(wm.toSummary());
    expect(summary.knownTransitions).toBe(1);
    expect(summary.hypotheses.length).toBe(1);
    expect(summary.goalCandidates.length).toBe(1);
  });
});
