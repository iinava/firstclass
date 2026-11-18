import { Noto_Sans, Poppins, Prata } from "next/font/google"
import { COMPANY } from "@/lib/company"
import { formatDate } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import {
  nightPlan as buildNightPlan,
  overnightPlace,
  pad2 as pad,
  splitPlaces,
  summaryLead,
  titleLines,
  toBullets,
} from "@/lib/itinerary-format"
import { Inline, RichText } from "@/components/shared/rich-text"
import { SafeImage } from "@/components/shared/safe-image"
import { FirstClassLogo } from "./brand-marks"

/*
 * Three families, matching the client's own itinerary template: Prata for the
 * serif cover band, Noto Sans for the body (the template is set in a DejaVu-like
 * sans) and Poppins for the letterhead contact block. Scoped to this component
 * so the admin UI never downloads them.
 */
const serif = Prata({ subsets: ["latin"], weight: "400", variable: "--font-itin-serif" })
const sans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-itin-sans",
})
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-poppins" })

export interface ItineraryDocumentData {
  itinerary: {
    code: string
    title: string
    destination: string | null
    durationDays: number
    durationNights: number
    summary: string | null
    coverImageUrl: string | null
    pricingMode: "per_pax" | "fixed"
    pricePerAdult: number | null
    pricePerChild: number | null
    fixedPrice: number | null
    inclusions: string[] | null
    exclusions: string[] | null
    termsAndConditions: string | null
    validUntil: string | null
  }
  days: {
    id: string
    dayNumber: number
    title: string
    description: string | null
    hotelName: string | null
    hotelCity: string | null
    stayNote: string | null
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }[]
  images: { id: string; dayId: string | null; url: string; caption: string | null }[]
}

/**
 * The customer-facing itinerary as an A4 document, laid out to the client's
 * template: letterhead, navy cover band, guest box, day-by-day table, night
 * plan, then pricing, inclusions and bank details on a fresh page.
 *
 * Photos are additions the template doesn't have. Every one sits in a box of
 * fixed height with `object-fit: cover`, and a photo that fails to load removes
 * itself (see SafeImage), so a bad picture can never push the layout around.
 */
export function ItineraryDocument({
  data,
  guestName,
}: {
  data: ItineraryDocumentData
  guestName?: string | null
}) {
  const { itinerary, days, images } = data
  const nights = itinerary.durationNights
  const daysCount = itinerary.durationDays

  const dayPhotos = new Map<string, string[]>()
  for (const image of images) {
    if (!image.dayId) continue
    dayPhotos.set(image.dayId, [...(dayPhotos.get(image.dayId) ?? []), image.url])
  }
  const gallery = images
    .filter((image) => !image.dayId && image.url !== itinerary.coverImageUrl)
    .filter((image, index, list) => list.findIndex((o) => o.url === image.url) === index)

  const nightRows = buildNightPlan(days, nights)
  const plannedNights = nightRows?.reduce((sum, row) => sum + row.nights, 0) ?? 0

  // A short plain summary is the banner's tagline; a pasted document becomes a
  // formatted overview section instead of a wall of text in the banner.
  const lead = summaryLead(itinerary.summary)
  const overview = !lead && itinerary.summary?.trim() ? itinerary.summary : null

  const priceRows: { label: string; amount: number }[] = []
  if (itinerary.pricingMode === "fixed" && itinerary.fixedPrice) {
    priceRows.push({
      label: `${itinerary.title} (${nights} nights / ${daysCount} days)`,
      amount: itinerary.fixedPrice,
    })
  }
  if (itinerary.pricingMode === "per_pax") {
    if (itinerary.pricePerAdult)
      priceRows.push({ label: "Per adult", amount: itinerary.pricePerAdult })
    if (itinerary.pricePerChild)
      priceRows.push({ label: "Per child", amount: itinerary.pricePerChild })
  }

  const inclusions = itinerary.inclusions?.filter(Boolean) ?? []
  const exclusions = itinerary.exclusions?.filter(Boolean) ?? []
  const places = splitPlaces(itinerary.destination)
  const where = places.length ? places.join(", ") : itinerary.title

  return (
    <div className={`${serif.variable} ${sans.variable} ${poppins.variable} itin`}>
      {/* Gold rule above the page footer; fixed, so print repeats it per sheet.
          The footer words and page number are @page margin boxes (globals.css). */}
      <span className="itin-foot-rule" aria-hidden="true" />

      <table className="itin-sheet">
        <thead>
          <tr>
            <td>
              <header className="itin-head">
                <FirstClassLogo className="itin-logo" />
                <address className="itin-contact">
                  <span>{COMPANY.phone}</span>
                  <span>{COMPANY.website}</span>
                  <span>{COMPANY.email}</span>
                </address>
              </header>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <div className="itin-body">
                {/* -------------------------------------------- cover band */}
                <section className="itin-banner">
                  <h1 className="itin-banner-title">ITINERARY</h1>
                  <p className="itin-banner-sub">
                    {nights} NIGHTS / {daysCount} DAYS IN {where.toUpperCase()}
                  </p>
                  <p className="itin-banner-tag">{lead ?? itinerary.title}</p>
                </section>

                {itinerary.coverImageUrl && (
                  <SafeImage
                    eager
                    src={itinerary.coverImageUrl}
                    alt={itinerary.title}
                    className="itin-cover"
                  />
                )}

                <section className="itin-guest">
                  <p>GUEST NAME : {guestName ?? ""}</p>
                  <p>
                    PACKAGE : {nights} Nights / {daysCount} Days
                  </p>
                  <p>ARRIVAL DATE :</p>
                  <p>DEPARTURE DATE :</p>
                </section>

                {overview && (
                  <section>
                    <h2 className="itin-heading">TOUR OVERVIEW</h2>
                    <RichText source={overview} className="itin-overview" />
                  </section>
                )}

                {/* ------------------------------------------ day by day */}
                {days.length > 0 && (
                  <section>
                    <h2 className="itin-heading">YOUR DAY-BY-DAY JOURNEY</h2>
                    <ol className="itin-days">
                      {days.map((day) => {
                        const bullets = toBullets(day.description)
                        const photos = (dayPhotos.get(day.id) ?? []).slice(0, 3)
                        const place = day.dayNumber <= nights ? overnightPlace(day) : null
                        const stay = [
                          place,
                          day.hotelName,
                          day.stayNote,
                        ].filter(Boolean)
                        const meals = [
                          day.breakfast && "Breakfast",
                          day.lunch && "Lunch",
                          day.dinner && "Dinner",
                        ].filter(Boolean)

                        return (
                          <li key={day.id} className="itin-day">
                            <div className="itin-day-label">
                              <strong>DAY {pad(day.dayNumber)}</strong>
                              {titleLines(day.title).map((line, index) => (
                                <span key={index}>{line}</span>
                              ))}
                            </div>
                            <div className="itin-day-body">
                              {bullets.length > 0 && (
                                <ul>
                                  {bullets.map((bullet, index) => (
                                    <li key={index}>
                                      <Inline text={bullet} />
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {photos.length > 0 && (
                                <div className="itin-day-photos">
                                  {photos.map((url) => (
                                    <SafeImage eager key={url} src={url} alt={day.title} />
                                  ))}
                                </div>
                              )}
                              {stay.length > 0 && (
                                <p className="itin-day-note">OVERNIGHT: {stay.join(" · ")}</p>
                              )}
                              {meals.length > 0 && (
                                <p className="itin-day-note">MEALS: {meals.join(", ")}</p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )}

                {/* ----------------------------------------- night plan */}
                {nightRows && (
                  <section className="itin-keep">
                    <h2 className="itin-heading">DESTINATION &amp; NIGHT PLAN</h2>
                    <table className="itin-table">
                      <thead>
                        <tr>
                          <th>DESTINATION</th>
                          <th className="itin-num">NIGHTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nightRows.map((row, index) => (
                          <tr key={index}>
                            <td>{row.place.toUpperCase()}</td>
                            <td className="itin-num">{pad(row.nights)}</td>
                          </tr>
                        ))}
                        <tr className="itin-total">
                          <td>TOTAL</td>
                          <td className="itin-num">{pad(plannedNights)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>
                )}

                {/* -------------------------------------------- gallery */}
                {gallery.length > 0 && (
                  <section>
                    <h2 className="itin-heading">GLIMPSES OF YOUR JOURNEY</h2>
                    <div className="itin-gallery">
                      {gallery.slice(0, 9).map((image) => (
                        <SafeImage
                          eager
                          key={image.id}
                          src={image.url}
                          alt={image.caption ?? itinerary.title}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* ---------------------------- pricing page (fresh sheet) */}
                <div className="itin-page-break">
                  <span className="itin-topbar" aria-hidden="true" />

                  {priceRows.length > 0 && (
                    <section className="itin-keep">
                      <h2 className="itin-title">PACKAGE PRICING</h2>
                      <table className="itin-table">
                        <thead>
                          <tr>
                            <th>
                              {itinerary.pricingMode === "per_pax"
                                ? "PRICE PER PERSON"
                                : "PACKAGE"}
                            </th>
                            <th className="itin-amount">AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceRows.map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td className="itin-amount">{formatMoneyShort(row.amount)}</td>
                            </tr>
                          ))}
                          {itinerary.pricingMode === "fixed" && itinerary.fixedPrice && (
                            <tr className="itin-total">
                              <td>GRAND TOTAL</td>
                              <td className="itin-amount">
                                {formatMoneyShort(itinerary.fixedPrice)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {itinerary.validUntil && (
                        <p className="itin-small">
                          Price valid till {formatDate(itinerary.validUntil)}.
                        </p>
                      )}
                    </section>
                  )}

                  {inclusions.length > 0 && (
                    <section className="itin-keep">
                      <h2 className="itin-heading">PACKAGE INCLUDES</h2>
                      <ul className="itin-checks">
                        {inclusions.map((item, index) => (
                          <li key={index}>
                            <span aria-hidden="true">✓</span>
                            <span>
                              <Inline text={item} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {exclusions.length > 0 && (
                    <section className="itin-keep">
                      <h2 className="itin-heading">PACKAGE EXCLUDES</h2>
                      <ul className="itin-checks">
                        {exclusions.map((item, index) => (
                          <li key={index}>
                            <span aria-hidden="true">✕</span>
                            <span>
                              <Inline text={item} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <section className="itin-keep">
                    <h2 className="itin-heading">BANK &amp; CONTACT DETAILS</h2>
                    <div className="itin-bank">
                      <p>
                        ACCOUNT NAME :<br />
                        {COMPANY.bank.accountName}
                      </p>
                      <p>
                        BANK :<br />
                        {COMPANY.bank.bankName}
                      </p>
                      <p>ACCOUNT NUMBER : {COMPANY.bank.accountNumber}</p>
                      <p>IFSC CODE {COMPANY.bank.ifsc}</p>
                    </div>
                    <p className="itin-strip">
                      FIRST CLASS TOURS &amp; TRAVELS | {COMPANY.contactPhones.join(" | ")}
                    </p>
                    <p className="itin-strip itin-strip-soft">
                      {COMPANY.email} | {COMPANY.website}
                    </p>
                  </section>

                  {itinerary.termsAndConditions && (
                    <section>
                      <h2 className="itin-heading">TERMS &amp; CONDITIONS</h2>
                      <RichText source={itinerary.termsAndConditions} className="itin-terms" />
                    </section>
                  )}

                  <p className="itin-ref">Reference {itinerary.code}</p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot aria-hidden="true">
          <tr>
            <td>
              <div className="itin-foot-space" />
            </td>
          </tr>
        </tfoot>
      </table>

      {/* On screen there are no pages, so the footer is drawn once at the end. */}
      <footer className="itin-screen-foot" aria-hidden="true">
        <span>FIRST CLASS TOURS &amp; TRAVELS</span>
      </footer>
    </div>
  )
}
