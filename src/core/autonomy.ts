import { AutonomyLevel } from './mcq_schema.js';

export class ActionClassifier {
  public classifyAction(
    action: string,
    confidence: number,
    trustScore: number,
    reversible: boolean,
    risk: string
  ): AutonomyLevel {
    if (risk === 'High' || !reversible) {
      return 'L4';
    }
    if (confidence > 0.9 && trustScore > 0.8) {
      return 'L1';
    }
    if (confidence > 0.75 && trustScore > 0.6) {
      return 'L2';
    }
    if (confidence > 0.5) {
      return 'L3';
    }
    return 'L4';
  }
}
