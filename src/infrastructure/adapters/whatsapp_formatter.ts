import { MCQPacket } from '../../core/mcq_schema.js';

export function formatWhatsAppMCQ(packet: MCQPacket): string {
  const optionsStr = Object.entries(packet.options)
    .map(([key, value]) => `${key}) ${value}`)
    .join('\n');

  const timeoutMsg = packet.timeout_mins < 1000 && packet.auto_action
    ? `Auto-proceeds with ${packet.auto_action} in ${packet.timeout_mins}min if no reply.`
    : 'Waiting for your reply.';

  return `[${packet.level} Decision Required]
Confidence: ${(packet.confidence * 100).toFixed(0)}% · Risk: ${packet.risk} · Reversible: ${packet.reversible ? 'Yes' : 'No'}

${packet.question}

${optionsStr}

${packet.semantic_diff}

${timeoutMsg}`;
}
