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
  })
  // FR16: a slot can't be created already in the past. Server time (new
  // Date() here, evaluated in the route handler) is authoritative, not
  // the vendor's device clock/timezone (NFR2).
  .refine((d) => new Date(d.startsAt) > new Date(), {
    message: "startsAt must not be in the past",
  });
