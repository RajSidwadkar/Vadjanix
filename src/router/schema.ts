import { z } from 'zod';

export const IntentPacketSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.enum(["read", "write", "propose", "query", "call", "refuse"]),
  payload: z.object({
    message: z.string(),
    details: z.record(z.any()).optional()
  }),
  auth: z.string().optional(),
  reply_to: z.string().optional(),
  reasoning: z.string()
}).strict();

export type IntentPacket = z.infer<typeof IntentPacketSchema>;

export interface RouterResult {
  success: boolean;
  status: number; // e.g., 200 (OK), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Internal Error)
  data?: any;
  error?: string;
}
