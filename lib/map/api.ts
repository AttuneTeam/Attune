import type { CreateAreaInput, UpdateAreaInput } from "./areaInput"

/**
 * The client side of the area endpoints.
 *
 * Every call returns a result rather than throwing. product-guidelines.md UX
 * principle 7 asks the product to fail quietly and honestly, which is only
 * possible if the caller always has a message to show and the manager's typed
 * text is never lost to an exception unwinding through a handler.
 */

export type MutationResult = { ok: true; id?: string } | { ok: false; message: string }

const GENERIC_FAILURE = "That could not be saved. Nothing has been changed."

/**
 * Pulls the server's message out of a failed response.
 *
 * A rejected request from our own route answers with JSON, but a proxy or a
 * dev-server crash answers with HTML — parsing that must not throw, and its
 * body must never be shown to the manager as an error message.
 */
async function messageFrom(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      body !== null &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      return (body as { error: string }).error
    }
  } catch {
    // Not JSON. Fall through to the generic message.
  }
  return GENERIC_FAILURE
}

async function send(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<MutationResult> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    })
  } catch {
    // Offline, DNS failure, dev server restarting.
    return { ok: false, message: GENERIC_FAILURE }
  }

  if (!response.ok) return { ok: false, message: await messageFrom(response) }

  try {
    const parsed: unknown = await response.json()
    const id =
      parsed !== null && typeof parsed === "object" && "id" in parsed
        ? String((parsed as { id: unknown }).id)
        : undefined
    return id === undefined ? { ok: true } : { ok: true, id }
  } catch {
    // A 200 with no body still means the write succeeded.
    return { ok: true }
  }
}

/**
 * Only the keys actually supplied are sent. The route's schema is strict, so
 * an explicit `domain: undefined` serialised as null would change the meaning
 * of the request from "no domain given" to "clear the domain".
 */
export function createArea(input: CreateAreaInput): Promise<MutationResult> {
  return send("/api/map/areas", "POST", pruneUndefined(input))
}

export function updateArea(id: string, input: UpdateAreaInput): Promise<MutationResult> {
  return send(`/api/map/areas/${id}`, "PATCH", pruneUndefined(input))
}

export function deleteArea(id: string): Promise<MutationResult> {
  return send(`/api/map/areas/${id}`, "DELETE")
}

/**
 * Moves an area one place within its group.
 *
 * Direction rather than an absolute position: the client does not know its
 * siblings' positions and should not have to, and letting it post a number
 * invites two clients writing the same one.
 */
export function moveArea(id: string, direction: "up" | "down"): Promise<MutationResult> {
  return send(`/api/map/areas/${id}/move`, "POST", { direction })
}

function pruneUndefined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}
