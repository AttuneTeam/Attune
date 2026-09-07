/**
 * Which domains the manager has collapsed, persisted across visits.
 *
 * Stored in a cookie rather than localStorage so the server can render the
 * correct state on first paint. localStorage is only readable after hydration,
 * which would show every domain expanded and then snap them shut — a flash on
 * a screen whose whole job is to feel calm. The project already persists
 * `sidebar-collapsed` this way.
 *
 * The stored value is untrusted input: it can be stale, truncated, hand-edited
 * or absent. Every one of those must still produce a usable map. A corrupt
 * preference is never a reason to fail to render someone's territory.
 */

/** Matches the existing `sidebar-collapsed` naming. */
export const COLLAPSED_DOMAINS_COOKIE = "map-collapsed-domains"

/**
 * A browser silently drops a cookie over roughly 4KB, which would lose the
 * preference entirely rather than partially. At ~24 encoded bytes per domain
 * this stays comfortably inside that, and no real map has this many domains.
 */
export const MAX_PERSISTED_DOMAINS = 60

/**
 * Domains are stored as their own values, null included, rather than as
 * stringified keys — a manager whose domain is literally called "ungrouped"
 * would otherwise collide with the ungrouped bucket.
 */
export type CollapsedDomains = Set<string | null>

function isDomainEntry(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

/**
 * Reads the cookie value. Accepts it percent-encoded (as written by
 * serialiseCollapsedDomains) or plain, since whether the caller's cookie API
 * has already decoded it is not something this module should have to know.
 */
export function parseCollapsedDomains(raw: string | undefined): CollapsedDomains {
  if (!raw) return new Set()

  for (const candidate of decodeCandidates(raw)) {
    const parsed = tryParseArray(candidate)
    if (parsed) return new Set(parsed.filter(isDomainEntry).slice(0, MAX_PERSISTED_DOMAINS))
  }

  return new Set()
}

function decodeCandidates(raw: string): string[] {
  try {
    const decoded = decodeURIComponent(raw)
    return decoded === raw ? [raw] : [decoded, raw]
  } catch {
    // Malformed percent-encoding — fall back to the value as given.
    return [raw]
  }
}

function tryParseArray(candidate: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(candidate)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Produces a cookie-safe value. Truncated at the cap rather than risking a dropped cookie. */
export function serialiseCollapsedDomains(collapsed: CollapsedDomains): string {
  return encodeURIComponent(
    JSON.stringify([...collapsed].slice(0, MAX_PERSISTED_DOMAINS)),
  )
}

/**
 * Persists the collapsed set for a year.
 *
 * Lives here rather than in the component for two reasons: the cookie's name,
 * format and lifetime then all sit in one place, and assigning `document.cookie`
 * inside a component body trips react-hooks/immutability, which treats it as
 * mutating an external value.
 *
 * A no-op without a document, so the module stays safe to call from anywhere.
 */
export function persistCollapsedDomains(collapsed: CollapsedDomains): void {
  if (typeof document === "undefined") return
  document.cookie = `${COLLAPSED_DOMAINS_COOKIE}=${serialiseCollapsedDomains(collapsed)}; path=/; max-age=31536000; SameSite=Lax`
}
