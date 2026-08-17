import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  BedDoubleIcon,
  CalendarDaysIcon,
  CheckIcon,
  MapPinIcon,
  MessageCircleIcon,
  MoonIcon,
  ShieldIcon,
  UsersIcon,
  UtensilsIcon,
  XIcon,
} from "lucide-react"

import { formatDate, formatDuration } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import {
  getItineraryByShareToken,
  recordItineraryView,
} from "@/lib/services/itinerary.service"
import { CoverImage } from "@/app/packages/_components/cover-image"
import { TRIP_TYPES, TripArt, tripTypeFor } from "@/app/packages/_components/trip-art"

export const dynamic = "force-dynamic"

/** Set to a WhatsApp-capable number to show the enquire buttons. */
const ENQUIRY_NUMBER = process.env.NEXT_PUBLIC_ENQUIRY_WHATSAPP?.replace(/\D/g, "")

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  if (!data) return { title: "Itinerary not found" }

  return {
    title: data.itinerary.title,
    description: data.itinerary.summary ?? undefined,
    // Unlisted links should not end up in search results.
    robots: { index: false, follow: false },
    openGraph: {
      title: data.itinerary.title,
      description: data.itinerary.summary ?? undefined,
      images: data.itinerary.coverImageUrl ? [data.itinerary.coverImageUrl] : undefined,
    },
  }
}

/**
 * Public, no-login itinerary page — the thing staff send the customer.
 *
 * It deliberately shows no internal data: no costs, no supplier names, no lead
 * or booking references. Only what the customer is buying.
 *
 * Presented like a brochure rather than a record: a full-bleed cover, photos
 * against the days they belong to, and one obvious way to reply. The admin
 * keeps its own plain, dense styling.
 */
export default async function SharedItineraryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  if (!data) notFound()

  const { itinerary, days, images } = data

  // Best-effort view counter; a failure here must not break the page.
  void recordItineraryView(itinerary.id).catch(() => {})

  const price =
    itinerary.pricingMode === "per_pax" ? itinerary.pricePerAdult : itinerary.fixedPrice
  const type = tripTypeFor(itinerary.title, itinerary.destination, itinerary.summary)
  const style = TRIP_TYPES[type]

  // A photo pinned to a day belongs with that day.
  const dayImages = new Map<string, string[]>()
  for (const image of images) {
    if (!image.dayId) continue
    dayImages.set(image.dayId, [...(dayImages.get(image.dayId) ?? []), image.url])
  }

  // The gallery is the unattached photos — but when staff have pinned all of
  // them to days, that leaves only the cover, and a "gallery" showing the same
  // picture as the top of the page is worse than none. Fall back to every
  // photo except the cover, deduplicated.
  const notCover = (url: string) => url !== itinerary.coverImageUrl
  const unattached = images.filter((image) => !image.dayId && notCover(image.url))
  const galleryImages = (
    unattached.length > 0 ? unattached : images.filter((image) => notCover(image.url))
  ).filter(
    (image, index, list) => list.findIndex((other) => other.url === image.url) === index
  )

  const enquiry = ENQUIRY_NUMBER
    ? `https://wa.me/${ENQUIRY_NUMBER}?text=${encodeURIComponent(
        `Hi! I'd like to go ahead with "${itinerary.title}" (${itinerary.code}). Can we talk about dates?`
      )}`
    : null

  const meals = (day: (typeof days)[number]) =>
    [day.breakfast && "Breakfast", day.lunch && "Lunch", day.dinner && "Dinner"].filter(
      Boolean
    )

  return (
    <main className="flex w-full flex-col">
      {/* ----------------------------------------------------------- cover */}
      <section className="relative isolate">
        <CoverImage
          src={itinerary.coverImageUrl}
          alt={itinerary.title}
          className="h-[58vh] max-h-[520px] min-h-[340px] w-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/40"
        />

        <div className="absolute inset-x-0 top-0 flex justify-center p-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
            <ShieldIcon className="size-3.5" />
            FIRST CLASS TRAVELS
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 pb-8 text-center sm:px-6">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${style.chip}`}
          >
            {style.label}
          </span>

          <h1 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            {itinerary.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/85">
            {itinerary.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="size-4" />
                {itinerary.destination}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <MoonIcon className="size-4" />
              {formatDuration(itinerary.durationDays, itinerary.durationNights)}
            </span>
            {days.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-4" />
                {days.length} day{days.length === 1 ? "" : "s"} planned
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        {/* ------------------------------------------------- price & intro */}
        <section className="flex flex-col gap-5">
          {itinerary.summary && (
            <p className="text-center text-lg leading-relaxed text-pretty text-muted-foreground">
              {itinerary.summary}
            </p>
          )}

          {price ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card p-6 text-center">
              <p className="text-3xl font-semibold tracking-tight">
                {formatMoneyShort(price)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  {itinerary.pricingMode === "per_pax" ? "per person" : "total package"}
                </span>
              </p>
              {itinerary.pricingMode === "per_pax" && itinerary.pricePerChild ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UsersIcon className="size-4" />
                  {formatMoneyShort(itinerary.pricePerChild)} per child
                </p>
              ) : null}
              {itinerary.validUntil && (
                <p className="text-xs text-muted-foreground">
                  Holds till {formatDate(itinerary.validUntil)}
                </p>
              )}
              {enquiry && (
                <a
                  href={enquiry}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <MessageCircleIcon className="size-4" />
                  I want this trip
                </a>
              )}
            </div>
          ) : null}
        </section>

        {/* ------------------------------------------------------ day by day */}
        {days.length > 0 && (
          <section className="flex flex-col gap-5">
            <header className="flex items-center gap-3">
              <TripArt type={type} className={`h-16 w-24 shrink-0 ${style.art}`} />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  How the trip goes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Day by day — all of it movable.
                </p>
              </div>
            </header>

            <ol className="flex flex-col gap-5">
              {days.map((day) => {
                const photos = dayImages.get(day.id) ?? []
                const dayMeals = meals(day)

                return (
                  <li
                    key={day.id}
                    className="overflow-hidden rounded-3xl border bg-card"
                  >
                    {photos.length > 0 && (
                      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                        {photos.slice(0, 2).map((url) => (
                          <CoverImage
                            key={url}
                            src={url}
                            alt={day.title}
                            className={
                              "h-44 w-full object-cover " +
                              (photos.length === 1 ? "sm:col-span-2 sm:h-56" : "")
                            }
                          />
                        ))}
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${style.chip}`}
                        >
                          {day.dayNumber}
                        </span>
                        <h3 className="font-medium text-pretty">{day.title}</h3>
                      </div>

                      {day.description && (
                        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                          {day.description}
                        </p>
                      )}

                      {(day.stayNote || dayMeals.length > 0) && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                          {day.stayNote && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              <BedDoubleIcon className="size-3.5" />
                              {day.stayNote}
                            </span>
                          )}
                          {dayMeals.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              <UtensilsIcon className="size-3.5" />
                              {dayMeals.join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* --------------------------------------------------------- gallery */}
        {galleryImages.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              A look at what you&apos;ll see
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryImages.map((image, index) => (
                <figure
                  key={image.id}
                  className={
                    "overflow-hidden rounded-2xl border " +
                    // First photo spans two cells so the grid is not a flat
                    // checkerboard of identical squares.
                    (index === 0 ? "col-span-2 row-span-2" : "")
                  }
                >
                  <CoverImage
                    src={image.url}
                    alt={image.caption ?? itinerary.title}
                    className={
                      "w-full object-cover " + (index === 0 ? "h-full min-h-56" : "h-32")
                    }
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------- inclusions/exclusions */}
        {(itinerary.inclusions?.length || itinerary.exclusions?.length) && (
          <section className="grid gap-4 sm:grid-cols-2">
            {itinerary.inclusions && itinerary.inclusions.length > 0 && (
              <div className="rounded-3xl border bg-card p-5">
                <h2 className="text-sm font-semibold">What&apos;s included</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {itinerary.inclusions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {itinerary.exclusions && itinerary.exclusions.length > 0 && (
              <div className="rounded-3xl border bg-card p-5">
                <h2 className="text-sm font-semibold">Not included</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {itinerary.exclusions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <XIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------- CTA */}
        {enquiry && (
          <section className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-3xl border bg-card p-8 text-center">
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b ${style.wash} to-transparent`}
            />
            <TripArt type={type} className={`h-14 w-20 ${style.art}`} />
            <h2 className="text-xl font-semibold tracking-tight text-balance">
              Like the look of it?
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Message us and we&apos;ll check the dates, adjust anything you want and
              hold it for you.
            </p>
            <a
              href={enquiry}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <MessageCircleIcon className="size-4" />
              Talk to us on WhatsApp
            </a>
          </section>
        )}

        {itinerary.termsAndConditions && (
          <section className="rounded-3xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Terms &amp; conditions</h2>
            <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
              {itinerary.termsAndConditions}
            </p>
          </section>
        )}

        <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
          <p>Prepared for you by First Class Travels.</p>
          <p className="mt-1">Reference {itinerary.code}</p>
          {/* Only for catalogue packages — a custom quote is one customer's own
              document and should not advertise its way back to a browse page. */}
          {itinerary.kind === "package" && (
            <Link
              href="/packages"
              className="mt-3 inline-block font-medium text-foreground underline underline-offset-4"
            >
              Browse all packages
            </Link>
          )}
        </footer>
      </div>
    </main>
  )
}
