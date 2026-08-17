import type { SVGProps } from "react"

/**
 * Hand-drawn scenery for the customer-facing pages.
 *
 * These are flat inline SVGs rather than an icon set or image files: they need
 * to sit behind photos at any size, take a per-trip accent colour, and cost
 * nothing to load on a phone. Everything is drawn with `currentColor` and the
 * accent classes below, so both themes are handled without a second palette.
 *
 * Only the public catalogue and share page use these — the admin keeps its own
 * plain, dense look.
 */

export type TripType =
  | "hills"
  | "backwaters"
  | "beach"
  | "wildlife"
  | "heritage"
  | "journey"

interface TypeStyle {
  label: string
  /** Solid badge, used over photography where a tint would wash out. */
  chip: string
  /** Colour for the illustration's shapes. */
  art: string
  /** Soft wash behind a card's illustration. */
  wash: string
}

export const TRIP_TYPES: Record<TripType, TypeStyle> = {
  hills: {
    label: "Hills & tea country",
    chip: "bg-emerald-600 text-white",
    art: "text-emerald-500",
    wash: "from-emerald-500/20",
  },
  backwaters: {
    label: "Backwaters",
    chip: "bg-sky-600 text-white",
    art: "text-sky-500",
    wash: "from-sky-500/20",
  },
  beach: {
    label: "Beaches",
    chip: "bg-amber-500 text-amber-950",
    art: "text-amber-500",
    wash: "from-amber-500/20",
  },
  wildlife: {
    label: "Wildlife & forest",
    chip: "bg-lime-600 text-white",
    art: "text-lime-600",
    wash: "from-lime-500/20",
  },
  heritage: {
    label: "Heritage & culture",
    chip: "bg-violet-600 text-white",
    art: "text-violet-500",
    wash: "from-violet-500/20",
  },
  journey: {
    label: "Grand tours",
    chip: "bg-rose-600 text-white",
    art: "text-rose-500",
    wash: "from-rose-500/20",
  },
}

/**
 * Guesses the kind of trip from what staff already typed.
 *
 * Deliberately keyword-based rather than a new database column: the catalogue
 * should stay useful without anyone having to go back and re-tag every package,
 * and a wrong guess only changes a decorative drawing.
 */
export function tripTypeFor(
  title: string,
  destination?: string | null,
  summary?: string | null
): TripType {
  const title_ = title.toLowerCase()
  const place = (destination ?? "").toLowerCase()
  const all = `${title_} ${place} ${(summary ?? "").toLowerCase()}`

  const inPlace = (...words: string[]) =>
    words.some((w) => place.includes(w) || title_.includes(w))
  const anywhere = (...words: string[]) => words.some((w) => all.includes(w))

  // Place names in the title or destination win over words that merely appear
  // in the blurb: "bird sanctuary" in a Kumarakom summary should not turn a
  // backwater stay into a wildlife trip. Multi-stop tours are checked first,
  // since they legitimately contain every other keyword.
  if (anywhere("grand tour", "circuit", "full kerala") || place.split(",").length > 3)
    return "journey"
  if (inPlace("houseboat", "backwater", "alleppey", "alappuzha", "kumarakom", "kuttanad", "vembanad"))
    return "backwaters"
  if (inPlace("beach", "kovalam", "varkala", "marari", "poovar", "bekal"))
    return "beach"
  if (inPlace("munnar", "wayanad", "vagamon", "idukki", "ponmudi", "hill", "tea"))
    return "hills"
  if (inPlace("thekkady", "periyar", "wildlife", "sanctuary", "safari", "forest"))
    return "wildlife"
  if (inPlace("fort", "temple", "palace", "heritage", "kochi", "cochin"))
    return "heritage"
  if (anywhere("wildlife", "safari", "sanctuary")) return "wildlife"
  return "journey"
}

/* --------------------------------------------------------------- scene art */

type ArtProps = SVGProps<SVGSVGElement>

/** Common wrapper: a 64×44 flat scene with a horizon the shapes sit on. */
function Scene({ children, ...props }: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 44"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  )
}

function Hills(props: ArtProps) {
  return (
    <Scene {...props}>
      <circle cx="50" cy="12" r="6" className="fill-current opacity-30" />
      <path
        d="M0 34c8-10 13-14 19-14s10 5 16 11 12 3 18-1 11 4 11 4v10H0V34Z"
        className="fill-current opacity-25"
      />
      <path
        d="M0 38c6-7 11-11 17-11s11 6 18 9 15 0 21-3v11H0v-6Z"
        className="fill-current opacity-60"
      />
      {/* tea rows */}
      <path
        d="M4 41c6-2 12-3 18-3s14 1 20 2M2 38c7-2 13-3 19-3"
        className="stroke-current opacity-40"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </Scene>
  )
}

function Backwaters(props: ArtProps) {
  return (
    <Scene {...props}>
      <circle cx="9" cy="10" r="5" className="fill-current opacity-25" />
      {/* palms, pushed to the edges so the boat owns the middle */}
      <path
        d="M58 32V16M58 16c-4-5-8-5-10-3 3-1 6 0 10 3Zm0 0c4-5 8-5 10-3-3-1-6 0-10 3Z"
        className="stroke-current opacity-45"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* houseboat: curved thatch roof on a hull, large enough to read small */}
      <path
        d="M12 27h34c0-8-7-12-17-12S12 19 12 27Z"
        className="fill-current opacity-55"
      />
      <path d="M7 27h44l-6 8H13l-6-8Z" className="fill-current opacity-85" />
      {/* water */}
      <path
        d="M2 40h60"
        className="stroke-current opacity-30"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="6 6"
      />
    </Scene>
  )
}

function Beach(props: ArtProps) {
  return (
    <Scene {...props}>
      <circle cx="46" cy="13" r="7" className="fill-current opacity-30" />
      <path
        d="M16 34V16M16 16c-4-5-9-5-12-2 4-2 8-1 12 2Zm0 0c4-5 9-5 12-2-4-2-8-1-12 2Z"
        className="stroke-current opacity-55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M0 34h64v10H0z" className="fill-current opacity-20" />
      <path
        d="M0 34c8 0 8 3 16 3s8-3 16-3 8 3 16 3 8-3 16-3"
        className="stroke-current opacity-60"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Scene>
  )
}

function Wildlife(props: ArtProps) {
  return (
    <Scene {...props}>
      <path d="M0 36h64v8H0z" className="fill-current opacity-20" />
      {/* canopy */}
      <circle cx="14" cy="22" r="9" className="fill-current opacity-45" />
      <circle cx="26" cy="26" r="7" className="fill-current opacity-30" />
      <circle cx="50" cy="20" r="10" className="fill-current opacity-40" />
      <path
        d="M14 36V26M50 36V24"
        className="stroke-current opacity-70"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* elephant silhouette */}
      <path
        d="M31 36v-4c0-3 3-5 6-5s6 2 6 5v4h-2v-3h-8v3h-2Zm12-6c1 1 1 3 0 5"
        className="fill-current stroke-current opacity-75"
        strokeWidth="0.8"
      />
    </Scene>
  )
}

function Heritage(props: ArtProps) {
  return (
    <Scene {...props}>
      <path d="M0 38h64v6H0z" className="fill-current opacity-20" />
      {/* tiled roofs stacked, Kerala temple style */}
      <path d="M32 6 18 16h28L32 6Z" className="fill-current opacity-60" />
      <path d="M32 15 13 26h38L32 15Z" className="fill-current opacity-45" />
      <path d="M18 26h28v12H18z" className="fill-current opacity-30" />
      <path d="M29 30h6v8h-6z" className="fill-current opacity-70" />
      {/* lamps */}
      <path
        d="M9 38v-8M55 38v-8"
        className="stroke-current opacity-50"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9" cy="27" r="2" className="fill-current opacity-70" />
      <circle cx="55" cy="27" r="2" className="fill-current opacity-70" />
    </Scene>
  )
}

function Journey(props: ArtProps) {
  return (
    <Scene {...props}>
      <path
        d="M0 36c10-14 18 6 28-6s16 8 24-6 12 4 12 4"
        className="stroke-current opacity-30"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <circle cx="12" cy="12" r="5" className="fill-current opacity-25" />
      {/* pins along the route */}
      <path
        d="M20 30c0-3 2-5 5-5s5 2 5 5c0 4-5 8-5 8s-5-4-5-8Z"
        className="fill-current opacity-65"
      />
      <path
        d="M44 20c0-3 2-5 5-5s5 2 5 5c0 4-5 8-5 8s-5-4-5-8Z"
        className="fill-current opacity-45"
      />
      <circle cx="25" cy="30" r="1.6" className="fill-background" />
      <circle cx="49" cy="20" r="1.6" className="fill-background" />
    </Scene>
  )
}

const ART: Record<TripType, (props: ArtProps) => React.ReactElement> = {
  hills: Hills,
  backwaters: Backwaters,
  beach: Beach,
  wildlife: Wildlife,
  heritage: Heritage,
  journey: Journey,
}

export function TripArt({
  type,
  className,
}: {
  type: TripType
  className?: string
}) {
  const Art = ART[type]
  return <Art className={className} />
}

/* ------------------------------------------------------------- hero banner */

/**
 * Wide layered landscape for the top of the catalogue: sun, two ridgelines,
 * palms, a houseboat and a few birds. Purely decorative.
 */
export function HeroScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 320"
      fill="none"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="960" cy="86" r="76" className="fill-amber-300/8" />
      <circle cx="960" cy="86" r="52" className="fill-amber-300/15" />
      <circle cx="960" cy="86" r="34" className="fill-amber-300/55" />

      {/* three ridgelines, each a little darker, for depth rather than one mass */}
      <path
        d="M0 196c110-52 180-72 260-58 80 14 122 66 204 54 82-13 130-64 216-56 86 8 142 54 236 44 56-6 96-22 136-38v178H0V196Z"
        className="fill-emerald-500/12"
      />
      <path
        d="M0 232c104-42 172-60 250-46 78 14 124 60 206 50 82-11 134-56 220-48 86 8 144 48 238 38 44-5 78-16 108-28v142H0v-108Z"
        className="fill-emerald-600/20"
      />
      <path
        d="M0 268c112-34 180-48 258-34 78 13 126 50 208 42 82-9 138-42 224-34 86 8 148 36 240 28 34-3 60-8 74-12v62H0v-52Z"
        className="fill-emerald-800/35"
      />

      {/* palms */}
      <g className="stroke-emerald-800/45" strokeWidth="5" strokeLinecap="round">
        <path d="M138 300v-72M138 228c-16-20-38-22-50-10 16-8 34-4 50 10Zm0 0c16-20 38-22 50-10-16-8-34-4-50 10Z" />
        <path d="M1064 300v-56M1064 244c-13-16-30-18-40-8 13-6 27-3 40 8Zm0 0c13-16 30-18 40-8-13-6-27-3-40 8Z" />
      </g>

      {/* houseboat on the waterline */}
      <g className="fill-sky-900/40">
        <path d="M520 276h116c0-24-22-36-58-36s-58 12-58 36Z" />
        <path d="M498 276h160l-18 20H516l-18-20Z" />
      </g>

      {/* water */}
      <path d="M0 298h1200v22H0z" className="fill-sky-500/10" />
      <g
        className="stroke-sky-400/20"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="14 26"
      >
        <path d="M0 307h1200" />
      </g>

      {/* birds */}
      <g
        className="stroke-foreground/25"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M232 92c8-8 16-8 24 0M256 92c8-8 16-8 24 0" />
        <path d="M700 62c6-6 12-6 18 0M718 62c6-6 12-6 18 0" />
      </g>
    </svg>
  )
}
