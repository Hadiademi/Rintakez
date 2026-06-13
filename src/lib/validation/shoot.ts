import { z } from "zod";
import { CANTONS, SHOOT_TYPES } from "./photographer";

export const createShootSchema = z
  .object({
    title: z.string().min(3).max(120),
    type: z.enum(SHOOT_TYPES),
    brief: z.string().min(10).max(4000),
    locationCity: z.string().min(1).max(120),
    locationPostcode: z.string().regex(/^[0-9]{4}$/).optional().or(z.literal("")),
    canton: z.enum(CANTONS),
    shootDate: z.string().refine((d) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsed = new Date(d + "T00:00:00");
      return !Number.isNaN(parsed.getTime()) && parsed >= today;
    }, "date_must_be_future"),
    durationHours: z.coerce.number().int().min(1).max(24),
    budgetMinChf: z.coerce.number().int().positive().max(1000000),
    budgetMaxChf: z.coerce.number().int().positive().max(1000000),
  })
  .refine((v) => v.budgetMaxChf >= v.budgetMinChf, {
    path: ["budgetMaxChf"],
    message: "budget_range",
  });

export type CreateShootInput = z.infer<typeof createShootSchema>;
