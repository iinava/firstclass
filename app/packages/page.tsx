import Link from "next/link"
import type { Metadata } from "next"
import {
  ArrowRightIcon,
  CameraIcon,
  MapPinIcon,
  MessageCircleIcon,
  MoonIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
} from "lucide-react"

import { formatDuration } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import {
  listCatalog,
  listCatalogDestinations,
  type CatalogCard,
} from "@/lib/services/itinerary.service"
import { CoverImage } from "./_components/cover-image"
import {
  HeroScene,
  TRIP_TYPES,
  TripArt,
  tripTypeFor,
  type TripType,
} from "./_components/trip-art"

/**
 * Public package catalogue — the page a customer browses to pick a trip.
 *
 * Deliberately warmer than the admin: big photography, drawn scenery and a
 * colour per kind of trip. Staff are working; a customer is daydreaming, and
 * the two want different pages.
 *
 * Still server-rendered with no client JavaScript beyond the image fallback —
 * filters are plain links and a GET form, so it works on a weak connection and
 * every filtered view is a URL that can be sent over WhatsApp.
 *
 * Only published packages appear. Custom quotes stay behind their own share
 * link — see `listCatalog`.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tour packages",
  description:
    "Browse our Kerala tour packages — hill stations, backwaters, wildlife and beaches. Pick the trip you like and talk to us.",
}

const SORTS = [
  { value: "newest", label: "Latest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "duration", label: "Shortest" },
] as const

/** Set to a WhatsApp-capable number to show the enquire buttons. */
const ENQUIRY_NUMBER = process.env.NEXT_PUBLIC_ENQUIRY_WHATSAPP?.replace(/\D/g, "")

function whatsappLink(packageTitle: string, code: string): string | null {
  if (!ENQUIRY_NUMBER) return null
  const text = `Hi! I'm interested in the "${packageTitle}" package (${code}). Could you share the details?`
  return `https://wa.me/${ENQUIRY_NUMBER}?text=${encodeURIComponent(text)}`
}

type Query = { search?: string; destination?: string; sort?: string; type?: string }

/** Rebuilds the query string with one key changed, for the filter links. */
function href(current: Query, change: Partial<Query>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) query.set(key, value)
  }
  const string = query.toString()
  return string ? `/packages?${string}` : "/packages"
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const sortParam = str("sort")
  const typeParam = str("type")
  const current: Query = {
    search: str("search"),
    destination: str("destination"),
    sort: SORTS.some((s) => s.value === sortParam) ? sortParam : undefined,
    type: typeParam && typeParam in TRIP_TYPES ? typeParam : undefined,
  }

  const [matched, destinations] = await Promise.all([
    listCatalog({
      search: current.search,
      destination: current.destination,
      sort: current.sort as "price_asc" | "price_desc" | "duration" | "newest",
    }),
    listCatalogDestinations(),
  ])

  // Trip type is derived from the text, not stored, so it is applied here
  // rather than in SQL. The list is capped at 60, so this stays cheap.
  const typed = matched.map((item) => ({
    item,
    type: tripTypeFor(item.title, item.destination, item.summary),
  }))
  const availableTypes = [...new Set(typed.map((t) => t.type))]
  const packages = current.type
    ? typed.filter((t) => t.type === current.type)
    : typed

  const isFiltered = Boolean(current.search || current.destination || current.type)
  const cheapest = matched.reduce<number | null>((min, item) => {
    const price = item.pricingMode === "per_pax" ? item.pricePerAdult : item.fixedPrice
    if (!price) return min
    return min === null || price < min ? price : min
  }, null)

  return (
    <main className="flex w-full flex-col">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden border-b bg-gradient-to-b from-sky-500/10 via-background to-background">
        <HeroScene className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full sm:h-72" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 pt-12 pb-44 text-center sm:px-6 sm:pt-16 sm:pb-56">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
            <ShieldIcon className="size-3.5" />
            FIRST CLASS TRAVELS
          </span>

          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Find the Kerala trip
            <span className="text-emerald-600 dark:text-emerald-400">
              {" "}
              you keep meaning to take
            </span>
          </h1>

          <p className="max-w-xl text-pretty text-muted-foreground">
            Tea hills, a night on the backwaters, elephants before breakfast. Pick
            one you like — we&apos;ll shape the dates, hotels and headcount around you.
          </p>

          {matched.length > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {matched.length} package{matched.length === 1 ? "" : "s"}
              </span>
              {cheapest && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    from{" "}
                    <span className="font-medium text-foreground">
                      {formatMoneyShort(cheapest)}
                    </span>{" "}
                    per person
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>tailored to you</span>
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
        {/* ------------------------------------------------- type chooser */}
        {availableTypes.length > 1 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-center text-sm font-medium tracking-wide text-muted-foreground">
              What kind of trip are you after?
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {availableTypes.map((type) => {
                const style = TRIP_TYPES[type]
                const active = current.type === type
                const count = typed.filter((t) => t.type === type).length
                return (
                  <li key={type}>
                    <Link
                      href={href(current, { type: active ? "" : type })}
                      aria-pressed={active}
                      className={
                        "group relative flex h-full flex-col items-center gap-1 overflow-hidden rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 " +
                        (active
                          ? "border-foreground/30 bg-card shadow-sm"
                          : "bg-card/60 hover:bg-card")
                      }
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${style.wash} to-transparent`}
                        aria-hidden="true"
                      />
                      <TripArt
                        type={type}
                        className={`relative h-12 w-16 ${style.art} transition-transform group-hover:scale-105`}
                      />
                      <span className="relative text-xs leading-tight font-medium text-pretty">
                        {style.label}
                      </span>
                      <span className="relative text-[11px] text-muted-foreground">
                        {count} trip{count === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ----------------------------------------------------- filters */}
        <section className="flex flex-col gap-4">
          <form
            action="/packages"
            className="mx-auto flex w-full max-w-lg gap-2 rounded-full border bg-card p-1.5 shadow-sm"
          >
            {current.destination && (
              <input type="hidden" name="destination" value={current.destination} />
            )}
            {current.sort && <input type="hidden" name="sort" value={current.sort} />}
            {current.type && <input type="hidden" name="type" value={current.type} />}
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="search"
                defaultValue={current.search ?? ""}
                placeholder="Munnar, houseboat, 3 nights…"
                aria-label="Search packages"
                className="h-10 w-full rounded-full bg-transparent pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="h-10 shrink-0 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Search
            </button>
          </form>

          {destinations.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href={href(current, { destination: "" })}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (current.destination
                    ? "text-muted-foreground hover:bg-muted"
                    : "border-transparent bg-foreground text-background")
                }
              >
                Everywhere
              </Link>
              {destinations.map((place) => {
                const active = current.destination === place
                return (
                  <Link
                    key={place}
                    href={href(current, { destination: active ? "" : place })}
                    className={
                      "rounded-full border px-3 py-1 text-xs transition-colors " +
                      (active
                        ? "border-transparent bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted")
                    }
                  >
                    {place}
                  </Link>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">Sort by</span>
            {SORTS.map((sort) => {
              const active = (current.sort ?? "newest") === sort.value
              return (
                <Link
                  key={sort.value}
                  href={href(current, { sort: sort.value })}
                  aria-current={active ? "true" : undefined}
                  className={
                    "rounded-full px-2.5 py-1 transition-colors " +
                    (active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {sort.label}
                </Link>
              )
            })}
          </div>
        </section>

        {/* ------------------------------------------------------- results */}
        {packages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed p-12 text-center">
            <TripArt type="journey" className="h-16 w-24 text-muted-foreground" />
            <p className="text-lg font-medium">Nothing matches that yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isFiltered
                ? "Try another destination or kind of trip — or tell us what you had in mind and we'll build it."
                : "New packages are being put together. Please check back shortly."}
            </p>
            {isFiltered && (
              <Link
                href="/packages"
                className="mt-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Show everything
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map(({ item, type }) => (
              <PackageCard key={item.code} item={item} type={type} />
            ))}
          </ul>
        )}

        {/* ---------------------------------------------------- reassurance */}
        <section className="grid gap-4 rounded-3xl border bg-card p-6 sm:grid-cols-3">
          {[
            {
              title: "Nothing is fixed",
              body: "Every package is a starting point. Swap hotels, add a day, change the dates.",
            },
            {
              title: "Local, all the way",
              body: "Our own vehicles and drivers, and hotels we have actually stayed in.",
            },
            {
              title: "One person, start to finish",
              body: "The same consultant plans your trip and answers the phone while you are on it.",
            },
          ].map((point) => (
            <div key={point.title} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <SparklesIcon className="size-4 text-amber-500" />
                {point.title}
              </p>
              <p className="text-sm text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </section>
      </div>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">First Class Travels</p>
        <p className="mt-1">
          Tell us what you want changed — that is usually where the good trips start.
        </p>
      </footer>
    </main>
  )
}

/* ------------------------------------------------------------------- card */

function PackageCard({ item, type }: { item: CatalogCard; type: TripType }) {
  const style = TRIP_TYPES[type]
  const price = item.pricingMode === "per_pax" ? item.pricePerAdult : item.fixedPrice
  const enquire = whatsappLink(item.title, item.code)
  const strip = item.photos.slice(0, 3)
  const highlights = item.dayTitles.slice(0, 3)

  return (
    <li className="group flex flex-col overflow-hidden rounded-3xl border bg-card transition-all hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/i/${item.shareToken}`} className="relative block overflow-hidden">
        <CoverImage
          src={item.coverImageUrl}
          alt={item.title}
          className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Photos are whatever staff pasted in, so the title needs a scrim
            heavy enough to stay legible over a bright sky as well as a dark one. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25"
        />

        <span
          className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${style.chip}`}
        >
          {style.label}
        </span>

        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <MoonIcon className="size-3" />
          {formatDuration(item.durationDays, item.durationNights)}
        </span>

        {/* No illustration over the photo: at this size the scenery reads as a
            coloured smudge, and the badge already says what kind of trip it is. */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 text-lg leading-tight font-semibold text-balance text-white">
            {item.title}
          </h3>
          {item.destination && (
            <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
              <MapPinIcon className="size-3 shrink-0" />
              <span className="line-clamp-1">{item.destination}</span>
            </p>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {item.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        )}

        {highlights.length > 0 && (
          <ul className="flex flex-col gap-1">
            {highlights.map((day, index) => (
              <li
                key={day}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span className="line-clamp-1">{day}</span>
              </li>
            ))}
            {item.dayTitles.length > highlights.length && (
              <li className="pl-6 text-xs text-muted-foreground/70">
                +{item.dayTitles.length - highlights.length} more day
                {item.dayTitles.length - highlights.length === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        )}

        {strip.length > 0 && (
          <Link
            href={`/i/${item.shareToken}`}
            className="flex items-center gap-1.5"
            aria-label={`See photos of ${item.title}`}
          >
            {strip.map((url) => (
              <CoverImage
                key={url}
                src={url}
                alt=""
                className="size-12 flex-1 rounded-lg object-cover"
              />
            ))}
            <span className="inline-flex size-12 flex-col items-center justify-center rounded-lg border border-dashed text-[10px] text-muted-foreground">
              <CameraIcon className="size-3.5" />
              more
            </span>
          </Link>
        )}

        {/* mt-auto keeps the price row aligned across cards of different heights. */}
        <div className="mt-auto flex flex-col gap-3 pt-1">
          <div className="flex items-end justify-between gap-2">
            {price ? (
              <p className="text-xl font-semibold tracking-tight">
                {formatMoneyShort(price)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {item.pricingMode === "per_pax" ? "per person" : "total"}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Price on request</p>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/i/${item.shareToken}`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-medium transition-colors hover:bg-muted"
            >
              See the plan
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {enquire && (
              <a
                href={enquire}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <MessageCircleIcon className="size-3.5" />
                Enquire
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
