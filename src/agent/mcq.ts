import { AutonomyLevel, MCQPacket } from '../core/mcq_schema.js';

export { AutonomyLevel, MCQPacket };

export function classifyAction(
  action: string,
  confidence: number,
  trustScore: number,
  contactCategory: string
): AutonomyLevel {
  // HARD RULE: if contactCategory === 'protected' -> ALWAYS return 'L4'
  if (contactCategory === 'protected') {
    return 'L4';
  }

  // Security: Handle NaN or invalid numbers by falling back to most restrictive level
  if (typeof confidence !== 'number' || isNaN(confidence) || 
      typeof trustScore !== 'number' || isNaN(trustScore)) {
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

export function formatWhatsAppMCQ(packet: MCQPacket): string {
  const levelHeader = `[${packet.level} Decision Required]`;
  const confidence = `Confidence: ${(packet.confidence * 100).toFixed(0)}%`;
  const risk = `Risk: ${packet.risk}`;
  const reversible = `Reversible: ${packet.reversible ? 'Yes' : 'No'}`;
  
  const optionsText = Object.entries(packet.options)
    .map(([key, action]) => `${key}: ${action}`)
    .join('\n');

  const diffText = `Proposed Change:\n${packet.semantic_diff}`;
  
  let footer = 'Waiting for your reply.';
  if (packet.level === 'L3') {
    footer = `Auto-proceeds in ${packet.timeout_mins || 15}min if no reply.`;
  }

  return `${levelHeader}\n\n${packet.question}\n\n${diffText}\n\nOptions:\n${optionsText}\n\n${confidence}\n${risk}\n${reversible}\n\n${footer}`;
}
