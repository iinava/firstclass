import { Poppins } from "next/font/google"
import { COMPANY, COMPANY_ADDRESS_LINE } from "@/lib/company"
import { FirstClassLogo, FirstClassWatermark } from "./brand-marks"

// The stationery is set in Poppins. Scoped to this component rather than the
// root layout so the admin UI keeps Geist and nobody pays for a second family
// on screens that never print.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
})

/**
 * The company letterhead as an A4 sheet: pale mark behind the copy, logo and
 * contact details above the navy rule, address below it. `children` land in the
 * band between the two.
 *
 * Positions are millimetres measured off the printed artwork ("letter head.pdf")
 * — see the `.letterhead` rules in `app/globals.css`.
 *
 * The table is load-bearing, not decoration. A document that runs past one page
 * has to reprint the letterhead on every sheet, and `thead`/`tfoot` are the only
 * things a browser repeats across page breaks *and* reserves height for — fixed
 * positioning repeats but reserves nothing. So the two are used together: the
 * table sections hold the space open on every page, and the pieces that have to
 * paint at an exact spot on the paper are positioned over them.
 */
export function Letterhead({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} letterhead`}>
      {/* Neither of these is in the table: the mark bleeds off the sheet, so it
          has to escape the cell box, and the footer has to sit at the foot of
          every page — including the last, where a `tfoot` would stop directly
          under the content instead. Fixed positioning reprints both on every
          page; the empty `tfoot` below keeps the space for this one clear. */}
      <div className="letterhead-wash" aria-hidden="true">
        <FirstClassWatermark className="letterhead-wash-mark" />
      </div>

      <div className="letterhead-foot">
        <div className="letterhead-foot-text">
          <p className="letterhead-foot-name">{COMPANY.legalName}</p>
          <p>{COMPANY_ADDRESS_LINE}</p>
        </div>
      </div>

      <table className="letterhead-sheet">
        <thead>
          <tr>
            <td>
              <div className="letterhead-head">
                <FirstClassLogo className="letterhead-logo" />
                <address className="letterhead-contact">
                  <span className="letterhead-contact-phone">
                    {COMPANY.phone}
                  </span>
                  <span>{COMPANY.website}</span>
                  <span>{COMPANY.email}</span>
                </address>
                <span className="letterhead-rule" />
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <div className="letterhead-body">{children}</div>
            </td>
          </tr>
        </tbody>

        <tfoot aria-hidden="true">
          <tr>
            <td>
              <div className="letterhead-foot-space" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
