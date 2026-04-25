import { z } from 'zod';

export const IntentPacketSchema = z.object({
  from: z.string().startsWith("vadjanix://"),
  to: z.string(),
  action: z.enum(["read", "write", "propose", "query", "call", "refuse"]),
  payload: z.object({
    message: z.string(),
    rate: z.number().optional(),
    content: z.string().optional(),
    suggested_days: z.array(z.string()).optional(),
  }).and(z.record(z.any())),
  reasoning: z.string(),
  auth: z.string().optional(),
  reply_to: z.string().optional(),
});

export type IntentPacket = z.infer<typeof IntentPacketSchema>;
