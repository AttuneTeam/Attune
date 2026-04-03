/**
 * Formats a start date as a compact tenure string, e.g. "2y 4m" or "8m".
 */
export function formatTenure(startDate: string): string {
  const start = new Date(startDate)
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}
