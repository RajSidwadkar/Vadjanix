import { describe, it, expect, beforeEach } from 'vitest';
import { VadjanixARC3Agent } from '../src/core/arc_agent.js';
import { hashState } from '../src/core/world_model.js';

describe('VadjanixARC3Agent', () => {
  let agent: VadjanixARC3Agent;

  beforeEach(() => {
    agent = new VadjanixARC3Agent('test-agent');
  });

  it('should start in EXPLORE phase', () => {
    expect(agent.phase).toBe('EXPLORE');
  });

  it('should transition to PLAN phase when high reward is found and then to EXECUTE if path exists', () => {
    const s1 = { pos: 0 };
    const s2 = { pos: 1 };
    const s3 = { pos: 2 };
    const h1 = hashState(s1);
    const h2 = hashState(s2);
    const h3 = hashState(s3);

    // Initial state s1
    agent.step(s1, ['move'], 0);
    
    // We are at s1. We want to go to s3.
    // Manually add transition s1 -> s2 -> s3
    agent.worldModel.update(
        agent.stateGraph.get(h1)!,
        'move',
        { rawObs: s2, stateHash: h2, visited: true, reward: 0 },
        0
    );
    agent.worldModel.update(
        { rawObs: s2, stateHash: h2, visited: true, reward: 0 },
        'jump',
        { rawObs: s3, stateHash: h3, visited: true, reward: 1 },
        1
    );

    // Set goal to s3
    agent.goalState = { rawObs: s3, stateHash: h3, visited: true, reward: 1 };
    agent.phase = 'PLAN';
    
    // Current state is s1. Step with s1 should find path s1->s2->s3
    // But wait, step(s1) will update (s1, lastAction, s1). 
    // To avoid overwrite, let's make sure lastAction was NOT 'move'.
    (agent as any)._lastAction = 'stay'; 
    
    agent.step(s1, ['move', 'stay'], 0);
    expect(agent.phase).toBe('EXECUTE');
  });

  it('should transition to HYPOTHESIZE when stateGraph is large and hypotheses exist', () => {
    for (let i = 0; i < 5; i++) {
        agent.worldModel.update(
            { rawObs: `h${i}`, stateHash: `h${i}`, visited: true, reward: 0 },
            `act${i}`,
            { rawObs: `h${i+1}`, stateHash: `h${i+1}`, visited: true, reward: 1 },
            1 
        );
    }
    agent.worldModel.hypotheses.forEach(h => h.confidence = 0.7);
    
    for (let i = 0; i < 25; i++) {
        agent.step({ state: i }, ['move'], 0);
    }

    expect(agent.phase).toBe('HYPOTHESIZE');
  });

  it('_bfsToGoal should find a path in a simple 4-state graph', () => {
    const s1 = '1', s2 = '2', s3 = '3', s4 = '4';
    
    agent.worldModel.update(
        { rawObs: 1, stateHash: s1, visited: true, reward: 0 },
        'a',
        { rawObs: 2, stateHash: s2, visited: true, reward: 0 },
        0
    );
    agent.worldModel.update(
        { rawObs: 2, stateHash: s2, visited: true, reward: 0 },
        'b',
        { rawObs: 3, stateHash: s3, visited: true, reward: 0 },
        0
    );
    agent.worldModel.update(
        { rawObs: 3, stateHash: s3, visited: true, reward: 0 },
        'c',
        { rawObs: 4, stateHash: s4, visited: true, reward: 0 },
        0
    );

    const path = agent._bfsToGoal(s1, s4);
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('should transition through phases correctly', () => {
    expect(agent.phase).toBe('EXPLORE');

    for (let i = 0; i < 5; i++) {
        agent.worldModel.update(
            { rawObs: `h${i}`, stateHash: `h${i}`, visited: true, reward: 0 },
            `act${i}`,
            { rawObs: `h${i+1}`, stateHash: `h${i+1}`, visited: true, reward: 1 },
            1
        );
    }
    agent.worldModel.hypotheses.forEach(h => h.confidence = 0.7);

    for (let i = 0; i < 25; i++) {
        agent.step({ s: i }, ['act0', 'act1', 'act2', 'act3', 'act4', 'move'], 0);
    }
    expect(agent.phase).toBe('HYPOTHESIZE');

    // Transition to PLAN
    agent.step({ s: 100 }, ['act0', 'act1', 'act2', 'act3', 'act4'], 0);
    agent.step({ s: 101 }, ['act1', 'act2', 'act3', 'act4'], 0);
    agent.step({ s: 102 }, ['act2', 'act3', 'act4'], 0);
    
    expect(agent.phase).toBe('PLAN');

    const goalObs = { goal: true };
    const goalHash = hashState(goalObs);
    agent.goalState = { rawObs: goalObs, stateHash: goalHash, visited: true, reward: 1 };
    
    // Add transition from current state to goal
    (agent as any)._lastAction = 'stay';
    agent.worldModel.update(
        agent.currentState!,
        'win',
        agent.goalState,
        1
    );

    // Step at same state to trigger PLAN -> EXECUTE
    agent.step(agent.currentState!.rawObs, ['win', 'stay'], 0);
    expect(agent.phase).toBe('EXECUTE');
  });
});
