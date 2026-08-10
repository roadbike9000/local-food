import { z } from "zod";

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
export const CreateSlotSchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().positive().default(20),
    location: z.string().optional(),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: "endsAt must be after startsAt",
  });
