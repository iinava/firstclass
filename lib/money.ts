/**
 * Money handling.
 *
 * Every monetary value in the database is an INTEGER number of paise.
 * Floats are never used for money — 0.1 + 0.2 !== 0.3 and an ERP that
 * disagrees with the client's calculator by a rupee loses all trust.
 *
 * Convention:
 *   - storage / all business logic  -> paise (number)
 *   - user input / display          -> rupees (string or number)
 */

/** Convert a rupee amount from user input into paise. */
export function toPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === "") return 0
  const n = typeof rupees === "string" ? Number(rupees.replace(/,/g, "")) : rupees
  if (!Number.isFinite(n)) return 0
  // Round rather than truncate so 12.005 -> 1201, not 1200. `n * 100` alone
  // suffers from float imprecision — e.g. 1.005 * 100 is 100.49999999999999
  // in JS floating point, which Math.round would wrongly floor to 100 instead
  // of 101. Routing the product through toFixed(2) first snaps it back onto
  // the nearest cent before rounding.
  return Math.round(Number((n * 100).toFixed(2)))
}

/** Convert paise into a rupee number, for form fields and charts. */
export function toRupees(paise: number | null | undefined): number {
  if (!paise) return 0
  return paise / 100
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INR_COMPACT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

/** ₹1,23,456.00 — the canonical display format. */
export function formatMoney(paise: number | null | undefined): string {
  return INR.format(toRupees(paise ?? 0))
}

/** ₹1,23,456 — for dense tables and stat tiles where decimals are noise. */
export function formatMoneyShort(paise: number | null | undefined): string {
  return INR_COMPACT.format(toRupees(paise ?? 0))
}

/**
 * Indian-style abbreviation for dashboard tiles: ₹1.2L, ₹3.4Cr.
 * Falls back to the full format below ₹1,000.
 */
export function formatMoneyCompact(paise: number | null | undefined): string {
  const rupees = toRupees(paise ?? 0)
  const abs = Math.abs(rupees)
  const sign = rupees < 0 ? "-" : ""
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  return INR_COMPACT.format(rupees)
}

/**
 * GST is stored as basis points (5% -> 500 bps, i.e. percent x 100) so the
 * rate is always an integer. Tax is computed on the post-discount amount.
 */
export function calculateTax(taxableAmountPaise: number, taxRateBps: number): number {
  return Math.round((taxableAmountPaise * taxRateBps) / 10_000)
}

/** Percentage (5) <-> stored bps (500). */
export const percentToBps = (percent: number) => Math.round(percent * 100)
export const bpsToPercent = (bps: number) => bps / 100

export interface TotalsInput {
  subtotal: number
  discount?: number
  taxRateBps?: number
}

export interface Totals {
  subtotal: number
  discount: number
  taxableAmount: number
  taxRateBps: number
  taxAmount: number
  grandTotal: number
}

/**
 * The one place trip/invoice totals are computed. Both the booking form and
 * the invoice generator call this, so the two can never disagree.
 */
export function computeTotals({
  subtotal,
  discount = 0,
  taxRateBps = 0,
}: TotalsInput): Totals {
  const safeSubtotal = Math.max(0, Math.round(subtotal))
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), safeSubtotal)
  const taxableAmount = safeSubtotal - safeDiscount
  const taxAmount = calculateTax(taxableAmount, taxRateBps)
  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    taxableAmount,
    taxRateBps,
    taxAmount,
    grandTotal: taxableAmount + taxAmount,
  }
}

/** Margin helpers used across the P&L reports. */
export function profit(revenue: number, cost: number): number {
  return revenue - cost
}

export function marginPercent(revenue: number, cost: number): number {
  // Zero or negative revenue has no meaningful margin percentage — and
  // dividing by a negative revenue would flip the sign of the result.
  if (revenue <= 0) return 0
  return ((revenue - cost) / revenue) * 100
}
