import { z } from "zod"
import { CONFIDENCE_ORDER } from "./coverage"

/**
 * Validation for everything a client may write to an area.
 *
 * The schemas are strict, which is the point. Beyond rejecting malformed input
 * they define what a client is *allowed* to set: `kind`, `manager_id`, `depth`
 * and `last_reviewed_at` are server-owned, and an attempt to set one is a loud
 * 400 rather than a silent success that could detach a row from its owner or
 * quietly turn an area into an initiative.
 */

const title = z
  .string()
  .trim()
  .min(1, "An area needs a title.")
  .max(200, "That title is too long.")

/**
 * A blank domain means ungrouped, not a domain named "". Otherwise the map
 * grows a heading with no name that no grouping rule can sensibly place.
 */
const domain = z
  .string()
  .trim()
  .max(80, "That domain name is too long.")
  .nullable()
  .transform((value) => (value === null || value === "" ? null : value))

// Derived from CONFIDENCE_ORDER rather than restated, so the schema and the
// ranking used by the coverage summary cannot drift apart. The tuple keeps its
// literal type, so `confidence` infers as AreaConfidence, not string.
const confidence = z.enum(CONFIDENCE_ORDER)

export const createAreaInput = z
  .object({
    title,
    domain: domain.optional(),
    parent_id: z.string().uuid().nullable().optional(),
  })
  .strict()

export type CreateAreaInput = z.infer<typeof createAreaInput>

export const updateAreaInput = z
  .object({
    title: title.optional(),
    domain: domain.optional(),
    confidence: confidence.optional(),
    owner_id: z.string().uuid().nullable().optional(),
    /**
     * "I looked at this and nothing had changed." Only ever an explicit true —
     * there is no way to un-review something, so `false` is a caller bug.
     */
    reviewed: z.literal(true).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Nothing to update.",
  })

export type UpdateAreaInput = z.infer<typeof updateAreaInput>

/**
 * Turns validated update input into the columns to write.
 *
 * The review stamp is the interesting part. Changing confidence *is* a review
 * (FR3) — not stamping it would leave an area the manager just reassessed still
 * counting towards staleness. But renaming an area, moving it between domains
 * or reassigning its owner are not reviews: treating them as such would let a
 * tidy-up session silently reset the staleness clock across the whole map,
 * destroying the one signal this feature exists to provide.
 */
export function toAreaUpdate(
  input: UpdateAreaInput,
  now: Date = new Date(),
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (input.title !== undefined) patch.title = input.title
  if (input.domain !== undefined) patch.domain = input.domain
  if (input.owner_id !== undefined) patch.owner_id = input.owner_id
  if (input.confidence !== undefined) patch.confidence = input.confidence

  if (input.confidence !== undefined || input.reviewed) {
    patch.last_reviewed_at = now.toISOString()
  }

  return patch
}
