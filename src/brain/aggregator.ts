import { IntentPacket } from '../router/schema.js';

export type AggregationStrategy = 'first_wins' | 'consensus' | 'merge';

export class ResultAggregator {
  public async withTimeout(promise: Promise<IntentPacket>, ms: number = 10000): Promise<IntentPacket | null> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(null);
      }, ms);
    });

    return Promise.race([
      promise.then((res) => {
        clearTimeout(timeoutId);
        return res;
      }),
      timeoutPromise
    ]);
  }

  public async aggregateResults(results: (IntentPacket | null)[], strategy: AggregationStrategy): Promise<IntentPacket> {
    const validResults = results.filter((r): r is IntentPacket => r !== null);

    if (validResults.length === 0) {
      return {
        from: 'vadjanix://brain',
        to: 'user',
        action: 'refuse',
        payload: { message: "Swarm Error: All sub-agents failed or timed out." },
        reasoning: "Total swarm failure / timeout."
      };
    }

    switch (strategy) {
      case 'first_wins':
        return validResults[0];

      case 'consensus': {
        const firstMessage = validResults[0].payload.message;
        const allMatch = validResults.every(r => r.payload.message === firstMessage);
        if (allMatch) {
          return validResults[0];
        }
        return {
          from: 'vadjanix://brain',
          to: 'user',
          action: 'refuse',
          payload: { message: "Consensus failed: Sub-agents disagreed." },
          reasoning: "Consensus strategy required identical messages from all active sub-agents."
        };
      }

      case 'merge': {
        const messages = validResults.map(r => r.payload.message);
        const mergedContent = "Merged Results: \n- " + messages.join("\n- ");
        return {
          from: 'vadjanix://brain',
          to: 'user',
          action: 'write',
          payload: { message: mergedContent },
          reasoning: "Merge strategy: concatenated all valid sub-agent responses."
        };
      }

      default:
        return validResults[0];
    }
  }
}
