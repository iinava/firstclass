import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Prata } from "next/font/google"
import {
  BedDoubleIcon,
  CheckIcon,
  DownloadIcon,
  MapPinIcon,
  MessageCircleIcon,
  MoonIcon,
  PhoneIcon,
  UsersIcon,
  UtensilsIcon,
  XIcon,
} from "lucide-react"

import { FirstClassLogo } from "@/components/print/brand-marks"
import { Inline, RichText } from "@/components/shared/rich-text"
import { SafeImage } from "@/components/shared/safe-image"
import { COMPANY } from "@/lib/company"
import { formatDate } from "@/lib/format"
import {
  nightPlan,
  overnightPlace,
  pad2,
  splitPlaces,
  summaryLead,
  toBullets,
} from "@/lib/itinerary-format"
import { formatMoneyShort } from "@/lib/money"
import {
  getItineraryByShareToken,
  getUnavailableShareReason,
  recordItineraryView,
} from "@/lib/services/itinerary.service"
import { ShareUnavailable } from "./_components/share-unavailable"

export const dynamic = "force-dynamic"

const serif = Prata({ subsets: ["latin"], weight: "400", variable: "--font-itin-serif" })

/** Set to a WhatsApp-capable number to show the enquire buttons. */
const ENQUIRY_NUMBER = process.env.NEXT_PUBLIC_ENQUIRY_WHATSAPP?.replace(/\D/g, "")

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  if (!data) return { title: "Itinerary unavailable", robots: { index: false, follow: false } }

  const description = summaryLead(data.itinerary.summary) ?? undefined
  return {
    title: data.itinerary.title,
    description,
    // Unlisted links should not end up in search results.
    robots: { index: false, follow: false },
    openGraph: {
      title: data.itinerary.title,
      description,
      images: data.itinerary.coverImageUrl ? [data.itinerary.coverImageUrl] : undefined,
    },
  }
}

const NAVY = "#1e2b5e"

/**
 * Public, no-login itinerary page — the thing staff send the customer.
 *
 * It deliberately shows no internal data: no costs, no supplier names beyond
 * the hotel, no lead or booking references. Only what the customer is buying.
 *
 * Styled as the company's brochure (navy, gold, serif headings, the same look
 * as the PDF) in a fixed light palette, whatever theme the admin app is in.
 */
export default async function SharedItineraryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  if (!data) {
    // A real link that isn't open (draft, turned off, expired) gets an
    // explanation; only a link that never existed is a 404.
    const reason = await getUnavailableShareReason(token)
    if (reason) return <ShareUnavailable reason={reason} />
    notFound()
  }

  const { itinerary, days, images } = data

  // Best-effort view counter; a failure here must not break the page.
  void recordItineraryView(itinerary.id).catch(() => {})

  const nights = itinerary.durationNights
  const price =
    itinerary.pricingMode === "per_pax" ? itinerary.pricePerAdult : itinerary.fixedPrice
  const places = splitPlaces(itinerary.destination)
  const lead = summaryLead(itinerary.summary)
  const overview = !lead && itinerary.summary?.trim() ? itinerary.summary : null
  const plan = nightPlan(days, nights)
  const pdfHref = `/i/${token}/pdf/download`

  // Photos pinned to a day belong with that day; the rest form the gallery.
  const dayImages = new Map<string, string[]>()
  for (const image of images) {
    if (!image.dayId) continue
    dayImages.set(image.dayId, [...(dayImages.get(image.dayId) ?? []), image.url])
  }
  const gallery = images
    .filter((image) => !image.dayId && image.url !== itinerary.coverImageUrl)
    .filter((image, index, list) => list.findIndex((o) => o.url === image.url) === index)

  const enquiry = ENQUIRY_NUMBER
    ? `https://wa.me/${ENQUIRY_NUMBER}?text=${encodeURIComponent(
        `Hi! I'd like to go ahead with "${itinerary.title}" (${itinerary.code}). Can we talk about dates?`
      )}`
    : null

  const inclusions = itinerary.inclusions?.filter(Boolean) ?? []
  const exclusions = itinerary.exclusions?.filter(Boolean) ?? []

  return (
    <main
      className={`${serif.variable} flex min-h-svh w-full flex-col bg-[#f6f4ef] text-neutral-900`}
    >
      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <FirstClassLogo className="h-9 w-auto sm:h-11" />
          <div className="flex items-center gap-2">
            <a
              href={pdfHref}
              download
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[#1e2b5e]/20 px-3.5 text-sm font-medium text-[#1e2b5e] transition-colors hover:bg-[#1e2b5e]/5"
            >
              <DownloadIcon className="size-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </a>
            {enquiry && (
              <a
                href={enquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-9 items-center gap-2 rounded-full bg-emerald-600 px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:inline-flex"
              >
                <MessageCircleIcon className="size-4" />
                WhatsApp us
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden bg-[#1e2b5e] text-white">
        {itinerary.coverImageUrl && (
          <>
            <SafeImage
              eager
              src={itinerary.coverImageUrl}
              alt=""
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-[#121a3d] via-[#1e2b5e]/75 to-[#1e2b5e]/35"
            />
          </>
        )}
        <div className="mx-auto flex min-h-[340px] w-full max-w-6xl flex-col justify-end gap-4 px-4 pt-16 pb-10 sm:min-h-[420px] sm:px-6 sm:pb-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f9bb14] px-3 py-1 text-xs font-semibold tracking-wide text-[#1e2b5e] uppercase">
            <MoonIcon className="size-3.5" />
            {nights} Nights · {itinerary.durationDays} Days
          </span>
          <h1 className="max-w-4xl font-[family-name:var(--font-itin-serif)] text-3xl leading-tight text-balance sm:text-5xl">
            {itinerary.title}
          </h1>
          {places.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-white/90">
              <MapPinIcon className="size-4 shrink-0 text-[#f9bb14]" aria-hidden="true" />
              {places.map((place, index) => (
                <li key={place} className="flex items-center gap-2">
                  {index > 0 && <span className="text-white/40">→</span>}
                  {place}
                </li>
              ))}
            </ul>
          )}
          {lead && <p className="max-w-2xl text-lg leading-relaxed text-white/85">{lead}</p>}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        {/* ------------------------------------------------ sidebar (price) */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <div className="flex flex-col gap-4 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            {price ? (
              <div>
                <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  {itinerary.pricingMode === "per_pax" ? "Price per person" : "Package price"}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-[#1e2b5e]">
                  {formatMoneyShort(price)}
                </p>
                {itinerary.pricingMode === "per_pax" && itinerary.pricePerChild ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-neutral-600">
                    <UsersIcon className="size-4" />
                    {formatMoneyShort(itinerary.pricePerChild)} per child
                  </p>
                ) : null}
                {itinerary.validUntil && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Price holds till {formatDate(itinerary.validUntil)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                Ask us for a price for your dates and group size.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {enquiry && (
                <a
                  href={enquiry}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <MessageCircleIcon className="size-4" />I want this trip
                </a>
              )}
              <a
                href={pdfHref}
                download
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1e2b5e] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <DownloadIcon className="size-4" />
                Download itinerary (PDF)
              </a>
              <a
                href={`tel:${COMPANY.phoneHref}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 px-5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
              >
                <PhoneIcon className="size-4" />
                {COMPANY.phone}
              </a>
            </div>
          </div>

          {plan && (
            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Where you&apos;ll stay
              </h2>
              <ul className="mt-3 flex flex-col divide-y divide-black/5">
                {plan.map((row, index) => (
                  <li key={index} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{row.place}</span>
                    <span className="text-neutral-500">
                      {row.nights} night{row.nights === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------ main column */}
        <div className="flex min-w-0 flex-col gap-12 lg:order-1">
          {overview && (
            <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
              <SectionTitle eyebrow="At a glance" title="Tour overview" />
              <RichText source={overview} className="mt-5 text-[15px] text-neutral-700" />
            </section>
          )}

          {days.length > 0 && (
            <section>
              <SectionTitle eyebrow="Day by day" title="Your journey" />
              <ol className="relative mt-6 flex flex-col gap-5 before:absolute before:top-3 before:bottom-3 before:left-5 before:w-px before:bg-[#1e2b5e]/15">
                {days.map((day) => {
                  const bullets = toBullets(day.description)
                  const photos = (dayImages.get(day.id) ?? []).slice(0, 3)
                  const place = day.dayNumber <= nights ? overnightPlace(day) : null
                  const stay = [place, day.hotelName, day.stayNote].filter(Boolean).join(" · ")
                  const meals = [
                    day.breakfast && "Breakfast",
                    day.lunch && "Lunch",
                    day.dinner && "Dinner",
                  ].filter(Boolean)

                  return (
                    <li key={day.id} className="relative pl-14">
                      <span className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-full bg-[#1e2b5e] text-sm font-semibold text-white ring-4 ring-[#f6f4ef]">
                        {pad2(day.dayNumber)}
                      </span>
                      <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                        <div className="p-5">
                          <p className="text-xs font-semibold tracking-wider text-[#a07a0c] uppercase">
                            Day {day.dayNumber}
                          </p>
                          <h3 className="mt-0.5 text-lg font-semibold text-pretty text-[#1e2b5e]">
                            {day.title}
                          </h3>

                          {bullets.length > 0 && (
                            <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-neutral-700">
                              {bullets.map((bullet, index) => (
                                <li key={index} className="flex gap-2.5">
                                  <span
                                    aria-hidden="true"
                                    className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#f9bb14]"
                                  />
                                  <span>
                                    <Inline text={bullet} />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {photos.length > 0 && (
                          <div
                            className={`grid gap-1 px-5 ${
                              photos.length === 1
                                ? "grid-cols-1"
                                : photos.length === 2
                                  ? "grid-cols-2"
                                  : "grid-cols-3"
                            }`}
                          >
                            {photos.map((url) => (
                              <SafeImage
                                key={url}
                                src={url}
                                alt={day.title}
                                className={`w-full rounded-xl object-cover ${
                                  photos.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]"
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {(stay || meals.length > 0) && (
                          <div className="flex flex-wrap gap-2 p-5 pt-4">
                            {stay && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1e2b5e]/[0.06] px-3 py-1 text-xs text-[#1e2b5e]">
                                <BedDoubleIcon className="size-3.5" />
                                {stay}
                              </span>
                            )}
                            {meals.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f9bb14]/15 px-3 py-1 text-xs text-[#7a5c00]">
                                <UtensilsIcon className="size-3.5" />
                                {meals.join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {gallery.length > 0 && (
            <section>
              <SectionTitle eyebrow="Gallery" title="Glimpses of your journey" />
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gallery.map((image, index) => (
                  <SafeImage
                    key={image.id}
                    src={image.url}
                    alt={image.caption ?? itinerary.title}
                    className={`h-full w-full rounded-2xl object-cover ${
                      index === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-[4/3]"
                    }`}
                  />
                ))}
              </div>
            </section>
          )}

          {(inclusions.length > 0 || exclusions.length > 0) && (
            <section className="grid gap-4 sm:grid-cols-2">
              {inclusions.length > 0 && (
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-[#1e2b5e]">What&apos;s included</h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {inclusions.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-neutral-700">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>
                          <Inline text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {exclusions.length > 0 && (
                <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-[#1e2b5e]">Not included</h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {exclusions.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-neutral-700">
                        <XIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
                        <span>
                          <Inline text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {itinerary.termsAndConditions && (
            <details className="group rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-[#1e2b5e] marker:hidden">
                Terms &amp; conditions
                <span className="ml-2 text-sm font-normal text-neutral-500 group-open:hidden">
                  (tap to read)
                </span>
              </summary>
              <RichText
                source={itinerary.termsAndConditions}
                className="mt-4 text-sm text-neutral-600"
              />
            </details>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- closing CTA */}
      <section className="mt-auto bg-[#1e2b5e] text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-[family-name:var(--font-itin-serif)] text-2xl">
              Like the look of it?
            </h2>
            <p className="mt-1 max-w-md text-sm text-white/75">
              Message us and we&apos;ll check your dates, tailor anything you want and hold it
              for you.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {enquiry && (
              <a
                href={enquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white hover:opacity-90"
              >
                <MessageCircleIcon className="size-4" />
                Talk to us on WhatsApp
              </a>
            )}
            <a
              href={pdfHref}
              download
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[#1e2b5e] hover:opacity-90"
            >
              <DownloadIcon className="size-4" />
              Download PDF
            </a>
          </div>
        </div>
        <footer className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              {COMPANY.legalName} · {COMPANY.website} · {COMPANY.email}
            </p>
            <p>
              Reference {itinerary.code}
              {/* Only for catalogue packages: a custom quote is one customer's own
                  document and should not advertise its way back to a browse page. */}
              {itinerary.kind === "package" && (
                <>
                  {" · "}
                  <Link href="/packages" className="underline underline-offset-4">
                    Browse all packages
                  </Link>
                </>
              )}
            </p>
          </div>
        </footer>
      </section>
    </main>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header>
      <p className="text-xs font-semibold tracking-[0.14em] text-[#a07a0c] uppercase">{eyebrow}</p>
      <h2
        className="mt-1 font-[family-name:var(--font-itin-serif)] text-2xl sm:text-3xl"
        style={{ color: NAVY }}
      >
        {title}
      </h2>
    </header>
  )
}
