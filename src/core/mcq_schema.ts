export type AutonomyLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface MCQPacket {
  level: AutonomyLevel;
  question: string;
  options: Record<string, string>;
  semantic_diff: string;
  confidence: number;
  risk: 'Low' | 'Medium' | 'High';
  reversible: boolean;
  timeout_mins: number;
  auto_action?: string;
  capsule_id?: string;
}
