import { z } from "zod";

// A photographer's public reply to a review. Length mirrors the DB check
// constraint (`char_length(reply) between 1 and 2000`).
export const replyToReviewSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export type ReplyToReviewInput = z.infer<typeof replyToReviewSchema>;
