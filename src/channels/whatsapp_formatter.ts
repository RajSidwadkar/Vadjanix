import { MCQPacket } from '../core/mcq_schema.js';

/**
 * Formats a Multiple Choice Question (MCQ) for WhatsApp using its specific markdown.
 * @param packet The MCQ packet to format.
 * @returns A string formatted for WhatsApp.
 */
export function formatWhatsAppMCQ(packet: MCQPacket): string {
  const levelMap = {
    'L1': 'Autonomous',
    'L2': 'Heuristic',
    'L3': 'Decision Required',
    'L4': 'Critical Override'
  };

  let output = `VADJANIX [${packet.level} ${levelMap[packet.level]}]\n\n`;
  output += `${packet.question}\n\n`;

  if (packet.semantic_diff) {
    output += `Impact: ${packet.semantic_diff}\n\n`;
  }

  output += `Options:\n`;
  for (const [key, value] of Object.entries(packet.options)) {
    output += `${key}) ${value}\n`;
  }

  output += `\nContext:
- Risk: ${packet.risk}
- Confidence: ${Math.round(packet.confidence * 100)}%
- Reversible: ${packet.reversible ? 'Yes' : 'No'}`;

  if (packet.auto_action) {
    output += `\n\nAuto-proceeds with ${packet.auto_action} in ${packet.timeout_mins}min`;
  }

  return output;
}
