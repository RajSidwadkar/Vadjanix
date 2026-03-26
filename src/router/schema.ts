import { z } from 'zod';

export const IntentPacketSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.enum(["read", "write", "propose", "query", "call", "refuse"]),
  payload: z.object({
    message: z.string(),
    details: z.object({
      strategy: z.enum(['compromise', 'hold_firm', 'walk_away']).optional(),
      rate: z.number().optional()
    }).strict().optional()
  }),
  auth: z.string().optional(),
  reply_to: z.string().optional(),
  reasoning: z.string()
}).strict().superRefine((data, ctx) => {
  if (data.action === 'propose') {
    if (!data.payload.details?.strategy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Propose action MUST have a strategy in details",
        path: ["payload", "details", "strategy"]
      });
    }
    if (data.payload.details?.rate !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Propose action MUST NOT contain a raw rate number in details. Use a strategy instead.",
        path: ["payload", "details", "rate"]
      });
    }
  }
});

export type IntentPacket = z.infer<typeof IntentPacketSchema>;

export interface RouterResult {
  success: boolean;
  status: number; // e.g., 200 (OK), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Internal Error)
  data?: any;
  error?: string;
}
