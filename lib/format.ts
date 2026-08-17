import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns"

/** Parse the `date` columns Drizzle returns as "YYYY-MM-DD" strings. */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : parseISO(value)
  return isValid(date) ? date : null
}

/** 15 Aug 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  return date ? format(date, "d MMM yyyy") : "—"
}

/** 15 Aug 2026, 4:30 pm */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  return date ? format(date, "d MMM yyyy, h:mm a") : "—"
}

/** 15 Aug — for dense tables where the year is obvious from context. */
export function formatDateShort(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  return date ? format(date, "d MMM") : "—"
}

/** The `YYYY-MM-DD` form Postgres `date` columns expect. */
export function toDateInput(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  return date ? format(date, "yyyy-MM-dd") : ""
}

/** "in 3 days" / "2 days ago" / "today" — used across the follow-up queue. */
export function formatRelativeDay(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return "—"
  const days = differenceInCalendarDays(date, new Date())
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days === -1) return "Yesterday"
  if (days > 1) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

/** "3N/4D" */
export function formatDuration(days: number, nights: number): string {
  return `${nights}N/${days}D`
}

/** "2 adults, 1 child" */
export function formatPax(adults: number, children = 0, infants = 0): string {
  const parts = [`${adults} adult${adults === 1 ? "" : "s"}`]
  if (children > 0) parts.push(`${children} child${children === 1 ? "" : "ren"}`)
  if (infants > 0) parts.push(`${infants} infant${infants === 1 ? "" : "s"}`)
  return parts.join(", ")
}

/** Turn an enum value like "in_progress" into "In progress". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—"
  const spaced = value.replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Initials for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/** 1,284 — Indian digit grouping. */
export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(value ?? 0)
}

/** Indian mobile numbers, displayed as +91 98765 43210. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return phone
}
