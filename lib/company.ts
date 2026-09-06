/**
 * Letterhead details for printed documents, transcribed from the printed
 * stationery ("letter head.pdf") so an emailed invoice and a sheet of company
 * paper never disagree. Kept as one constant rather than a settings table — it
 * changes once a year at most, and a form to edit it is a screen nobody opens.
 */
export const COMPANY = {
  /** Trading name — the header lockup spells this out as artwork. */
  name: "First Class Tours and Travels",
  /** Footer wording, capitalised exactly as the stationery prints it. */
  legalName: "First Class Tours and Travels pvt Ltd",
  /** Printed as one pipe-separated line in the footer, top-to-bottom elsewhere. */
  addressLines: [
    "AB Complex",
    "Near KCMA UP School",
    "Kaattukulangara",
    "Nellikode (P.O)",
    "Calicut",
  ],
  /**
   * Grouped the way the letterhead groups it. Deliberately not passed through
   * `formatPhone` — that helper would regroup it as +91 88919 22766, which is
   * correct for Indian mobiles but does not match the printed stationery.
   */
  phone: "+91 8891 922 766",
  /** Dialable form, for `tel:` links on screen. */
  phoneHref: "+918891922766",
  email: "firstclasspvtltd@gmail.com",
  website: "www.firstclasstoursandtravels.com",
} as const

/** The footer address, on one line, as the stationery sets it. */
export const COMPANY_ADDRESS_LINE = COMPANY.addressLines.join(" | ")

/** A postal-style block, for the places one line would be too wide. */
export const COMPANY_ADDRESS = COMPANY.addressLines.join(", ")

/**
 * Letterhead ink, sampled from the artwork so screen, print and the SVG marks
 * in `components/print/brand-marks.tsx` all agree.
 */
export const BRAND = {
  /** Wordmark and rules. */
  navy: "#1E2B5E",
  /** The flame in the mark — used sparingly as an accent. */
  gold: "#F9BB14",
  /** Body grey the stationery sets its contact details in. */
  ink: "#58595B",
  /** The oversized mark behind the body copy. */
  wash: "#F2F2F3",
} as const
