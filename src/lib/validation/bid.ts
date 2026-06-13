import { z } from "zod";

export const createBidSchema = z.object({
  amountChf: z.coerce.number().int().positive().max(1000000),
  message: z.string().min(10).max(2000),
});

export type CreateBidInput = z.infer<typeof createBidSchema>;
