/**
 * Presentation helpers shared by the public itinerary page and its PDF, so the
 * two always read a day, a destination list or the night plan the same way.
 */

export interface DayLike {
  dayNumber: number
  title: string
  description: string | null
  hotelCity: string | null
}

export const pad2 = (n: number) => String(n).padStart(2, "0")

export const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())

/** A day's description as bullet lines, with any bullet staff typed themselves stripped off. */
export function toBullets(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[•\-*–·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
}

/** "Kochi to Munnar" → ["KOCHI", "TO", "MUNNAR"], the way the PDF template stacks it. */
export function titleLines(title: string): string[] {
  return title
    .split(/\s+to\s+/i)
    .flatMap((part, index) => (index === 0 ? [part] : ["to", part]))
    .map((part) => part.trim().toUpperCase())
}

/** "KOCHI,MUNNAR, Thekkady | Varkala" → ["Kochi", "Munnar", "Thekkady", "Varkala"]. */
export function splitPlaces(destination: string | null): string[] {
  if (!destination) return []
  return destination
    .split(/\s*[,|/;]\s*|\s+[–—-]\s+/)
    .map((place) => place.trim())
    .filter(Boolean)
    .map(titleCase)
}

const TRAILING_WORDS = /\s+(sightseeing|departure|arrival|tour|visit|excursion|local)$/i

/**
 * Where the guest sleeps after a given day: the hotel's city when a hotel is
 * picked, otherwise read off the day title ("Munnar to Thekkady" → Thekkady,
 * "Munnar Sightseeing" → Munnar).
 */
export function overnightPlace(day: DayLike): string | null {
  if (day.hotelCity?.trim()) return titleCase(day.hotelCity.trim())
  const parts = day.title.split(/\s+to\s+/i)
  const place = parts[parts.length - 1]
    .replace(/[–—-].*$/, "")
    .replace(TRAILING_WORDS, "")
    .trim()
  return place ? titleCase(place) : null
}

/**
 * Consecutive nights in one place collapsed into rows. Null when any night's
 * place can't be worked out: a half-filled plan reads as a mistake.
 */
export function nightPlan(
  days: DayLike[],
  nights: number
): { place: string; nights: number }[] | null {
  if (nights <= 0) return null
  const rows: { place: string; nights: number }[] = []
  for (const day of days) {
    if (day.dayNumber > nights) continue
    const place = overnightPlace(day)
    if (!place) return null
    const last = rows[rows.length - 1]
    if (last && last.place.toLowerCase() === place.toLowerCase()) last.nights++
    else rows.push({ place, nights: 1 })
  }
  return rows.length > 0 ? rows : null
}

/**
 * The summary as a one-line lead, when it is one: short, plain prose. Pasted
 * documents (headings, tables, lists) return null and are shown as a
 * formatted overview instead of being crammed into a tagline.
 */
export function summaryLead(summary: string | null): string | null {
  const text = summary?.trim()
  if (!text) return null
  if (text.length > 220) return null
  if (/\n\s*\n|^\s*(#|[-*•]\s|\d+[.)]\s|\|)/m.test(text)) return null
  return text.replace(/\*\*|__/g, "").replace(/\s+/g, " ")
}
