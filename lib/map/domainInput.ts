import { z } from "zod"

/**
 * Validation for the domain endpoints.
 *
 * Strict, for the same reason the area schemas are: `manager_id` and
 * `sort_order` are the server's, and a client trying to set either is a loud
 * 400 rather than a silent success.
 */

const name = z
  .string()
  .trim()
  .min(1, "A domain needs a name.")
  .max(80, "That domain name is too long.")

export const createDomainInput = z.object({ name }).strict()
export type CreateDomainInput = z.infer<typeof createDomainInput>

export const renameDomainInput = z.object({ name }).strict()
export type RenameDomainInput = z.infer<typeof renameDomainInput>

/**
 * Reordering is a direction, never an absolute position — the client does not
 * know its siblings' positions and should not have to.
 */
export const moveDomainInput = z
  .object({ direction: z.enum(["up", "down"]) })
  .strict()
export type MoveDomainInput = z.infer<typeof moveDomainInput>
