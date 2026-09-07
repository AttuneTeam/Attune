import type { StrategicInitiative } from "@/lib/supabase/types"

/**
 * The Surface Area Map's attention signal.
 *
 * A map that only stores what the manager typed into it has failed the second
 * success criterion in product.md — proactive signal, not passive storage. This
 * module is what makes the map decay: an area nobody has looked at, or nobody
 * owns, surfaces without being asked.
 *
 * Exactly two conditions flag an area (spec.md FR6). Confidence is NOT one of
 * them, and neither are interaction signals. A manager who records "I do not
 * understand this yet" is being honest; flagging them for it would train them
 * out of the honesty the whole map depends on.
 */

/**
 * Days after which an unreviewed area is considered neglected.
 *
 * Deliberately a single named constant. A manager's first quarter may not run
 * on a three-week rhythm, and this is the one edit that changes it.
 */
export const STALENESS_THRESHOLD_DAYS = 21

export type AttentionReason = "stale" | "unowned"

/**
 * The minimum shape needed to judge an area. Structural rather than the whole
 * row, so callers can pass a narrow query result — and so these helpers stay
 * usable from the list, where selecting every column would be wasteful.
 */
export type AttentionInput = Pick<
  StrategicInitiative,
  "created_at" | "last_reviewed_at" | "owner_id"
>

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole days since the area was last reviewed, falling back to when it was
 * captured.
 *
 * The fallback is what makes captured-and-forgotten areas surface at all: with
 * a null last_reviewed_at treated as "never due", the items a manager dumped in
 * on day one and never returned to would stay invisible forever — exactly the
 * blind spot the map exists to expose.
 *
 * Floored, not rounded: showing "14d" on the thirteenth day would report a day
 * the manager has not yet lived through. Clamped at zero so clock skew between
 * the database and the renderer cannot produce a negative age.
 */
export function daysSinceReview(area: AttentionInput, now: Date = new Date()): number {
  const reference = area.last_reviewed_at ?? area.created_at
  const elapsed = now.getTime() - new Date(reference).getTime()
  return Math.max(0, Math.floor(elapsed / MS_PER_DAY))
}

/**
 * True once the area has gone unreviewed for the threshold.
 *
 * The boundary is inclusive so the interface can say "not reviewed in 21 days"
 * and mean it. An exclusive boundary would flag on day 22 while the label read
 * 21 — a small lie, but this signal only works if the manager trusts it.
 */
export function isStale(area: AttentionInput, now: Date = new Date()): boolean {
  return daysSinceReview(area, now) >= STALENESS_THRESHOLD_DAYS
}

/**
 * Every reason this area is worth a look, in display order.
 *
 * Returns a list rather than a boolean so the interface can say *why* — "not
 * reviewed in 24 days" is actionable in a way that a bare coral dot is not
 * (product-guidelines.md: be specific).
 */
export function attentionReasons(
  area: AttentionInput,
  now: Date = new Date(),
): AttentionReason[] {
  const reasons: AttentionReason[] = []
  if (isStale(area, now)) reasons.push("stale")
  if (!area.owner_id) reasons.push("unowned")
  return reasons
}

/** Whether the area should carry the attention mark at all. */
export function needsAttention(area: AttentionInput, now: Date = new Date()): boolean {
  return attentionReasons(area, now).length > 0
}

/**
 * The review age as the map states it on a row.
 *
 * A never-reviewed area says so rather than reporting its age since capture:
 * "40d" would imply it was reviewed forty days ago, when in fact it has never
 * been looked at. That is a different and more useful thing for the manager to
 * know, and it is the honest reading of a null last_reviewed_at.
 */
export function formatReviewAge(area: AttentionInput, now: Date = new Date()): string {
  if (area.last_reviewed_at === null) return "never reviewed"

  const days = daysSinceReview(area, now)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days}d`
}
