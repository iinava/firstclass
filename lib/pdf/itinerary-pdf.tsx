import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import {
  Document,
  Font,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"
import type { ComponentProps, ReactNode } from "react"
import type { ItineraryDocumentData } from "@/components/print/itinerary-document"
import { parseRichText } from "@/components/shared/rich-text"
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
import { storage } from "@/lib/storage"
import { LOGO_PATHS, LOGO_VIEWBOX } from "./logo-paths"

/*
 * The itinerary PDF, drawn directly with @react-pdf/renderer: pure JavaScript,
 * no headless browser, so it runs on any server as-is. Laid out to the same
 * client template as the on-screen preview (components/print/itinerary-document.tsx):
 * letterhead, navy cover band, guest box, day-by-day table, night plan, then
 * pricing, inclusions and bank details on a fresh page.
 */

// ---------------------------------------------------------------- fonts

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts")
const font = (file: string) => path.join(FONT_DIR, file)

Font.register({
  family: "NotoSans",
  fonts: [
    { src: font("noto-sans-latin-400-normal.woff"), fontWeight: 400 },
    { src: font("noto-sans-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: font("noto-sans-latin-500-normal.woff"), fontWeight: 500 },
    { src: font("noto-sans-latin-700-normal.woff"), fontWeight: 700 },
  ],
})
// The "latin" files stop at Latin-1; ₹ and other symbols live in latin-ext.
Font.register({
  family: "NotoSansExt",
  fonts: [
    { src: font("noto-sans-latin-ext-400-normal.woff"), fontWeight: 400 },
    { src: font("noto-sans-latin-ext-400-normal.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: font("noto-sans-latin-ext-700-normal.woff"), fontWeight: 500 },
    { src: font("noto-sans-latin-ext-700-normal.woff"), fontWeight: 700 },
  ],
})
Font.register({
  family: "Poppins",
  fonts: [
    { src: font("poppins-latin-400-normal.woff"), fontWeight: 400 },
    { src: font("poppins-latin-500-normal.woff"), fontWeight: 500 },
  ],
})
Font.register({ family: "Prata", src: font("prata-latin-400-normal.woff") })
// Long words and URLs wrap at the box edge rather than being hyphenated.
Font.registerHyphenationCallback((word) => [word])

const SANS = ["NotoSans", "NotoSansExt"]
const SERIF = ["Prata", "NotoSansExt"]

// ---------------------------------------------------------------- palette

const NAVY = "#1f2a5c"
const INK_NAVY = "#1a2340"
const TABLE_NAVY = "#13213c"
const GOLD = "#c9a227"
const BEIGE = "#f4f0ea"
const BEIGE_LINE = "#e6dfd2"
const BEIGE_TOTAL = "#ebe4d6"
const GREY = "#6b7280"
const TEXT = "#2b2f36"
const DASH = "#9aa0aa"
const SIDE = "11mm"

const s = StyleSheet.create({
  page: {
    paddingTop: "40mm",
    paddingBottom: "20mm",
    paddingHorizontal: SIDE,
    fontFamily: SANS as unknown as string,
    fontSize: 10.5,
    lineHeight: 1.45,
    color: TEXT,
    backgroundColor: "#fff",
  },

  head: { position: "absolute", top: 0, left: 0, right: 0, height: "40mm" },
  logo: { position: "absolute", top: "3mm", left: "8mm", width: "58mm", height: "30.6mm" },
  contact: {
    position: "absolute",
    top: "24.5mm",
    right: "8mm",
    fontFamily: "Poppins",
    fontSize: 10.5,
    lineHeight: 1.12,
    letterSpacing: 1.2,
    color: TEXT,
    textAlign: "right",
  },

  // Pinned from the top: a fixed element anchored with `bottom` isn't drawn.
  foot: { position: "absolute", left: "18mm", right: "18mm", top: "281mm" },
  footRule: { height: 0.75, backgroundColor: GOLD, marginBottom: "2.5mm" },
  footRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#555" },

  banner: {
    minHeight: "56mm",
    paddingTop: "7mm",
    paddingBottom: "9mm",
    paddingHorizontal: "12mm",
    backgroundColor: NAVY,
    color: "#fff",
    fontFamily: SERIF as unknown as string,
  },
  bannerTitle: { textAlign: "center", fontSize: 27, lineHeight: 1.2, letterSpacing: 0.5 },
  bannerSub: { marginTop: "8mm", fontSize: 13 },
  bannerTag: { marginTop: "6mm", fontSize: 13.5, lineHeight: 1.35, color: "#eef0f6" },
  cover: { width: "100%", height: "62mm", objectFit: "cover" },

  guestRow: { flexDirection: "row", gap: "1mm", marginTop: "1mm" },
  guestCell: {
    flex: 1,
    minHeight: "18mm",
    justifyContent: "center",
    paddingHorizontal: "6mm",
    backgroundColor: BEIGE,
    borderWidth: 0.6,
    borderColor: BEIGE_LINE,
    fontSize: 11.5,
  },

  heading: {
    marginTop: "8mm",
    marginBottom: "3.5mm",
    marginHorizontal: "2mm",
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.25,
    color: INK_NAVY,
  },
  title: {
    marginVertical: "4mm",
    marginHorizontal: "2mm",
    fontSize: 20,
    fontWeight: 700,
    color: INK_NAVY,
  },

  day: { flexDirection: "row", gap: "1.2mm", marginBottom: "2mm" },
  dayLabel: {
    width: "52mm",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: "3mm",
    paddingHorizontal: "2mm",
    backgroundColor: BEIGE,
    borderWidth: 0.75,
    borderStyle: "dashed",
    borderColor: DASH,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 1.3,
    color: GREY,
  },
  dayNumber: { fontSize: 12.5, fontWeight: 700, color: INK_NAVY },
  dayBody: {
    flex: 1,
    paddingTop: "3mm",
    paddingBottom: "3mm",
    paddingLeft: "4.5mm",
    paddingRight: "4mm",
    borderWidth: 0.75,
    borderStyle: "dashed",
    borderColor: DASH,
    fontSize: 11,
  },
  bullet: { flexDirection: "row" },
  bulletDot: { width: "3.2mm" },
  bulletText: { flex: 1 },
  dayPhotos: { flexDirection: "row", gap: "1.5mm", marginTop: "2.5mm", marginBottom: "1mm" },
  dayPhoto: { flex: 1, height: "32mm", objectFit: "cover", borderRadius: "1mm" },
  dayNote: { marginTop: "1mm", paddingLeft: "1mm", color: GREY },

  table: { fontSize: 11.5 },
  tr: { flexDirection: "row" },
  th: {
    paddingVertical: "2.6mm",
    paddingHorizontal: "5mm",
    backgroundColor: TABLE_NAVY,
    color: "#fff",
    fontWeight: 700,
  },
  td: {
    paddingVertical: "2mm",
    paddingHorizontal: "5mm",
    backgroundColor: BEIGE,
    borderBottomWidth: 0.6,
    borderBottomColor: "#fbf9f6",
  },
  total: { paddingVertical: "2.8mm", backgroundColor: BEIGE_TOTAL, fontWeight: 700, color: INK_NAVY },

  galleryRow: { flexDirection: "row", gap: "2mm", marginBottom: "2mm" },
  galleryPhoto: { flex: 1, height: "44mm", objectFit: "cover", borderRadius: "1mm" },
  galleryGap: { flex: 1 },

  topbar: { height: "5mm", marginHorizontal: `-${SIDE}`, backgroundColor: TABLE_NAVY },
  topbarGold: { width: "42mm", height: "1.2mm", marginLeft: `-${SIDE}`, backgroundColor: GOLD },

  small: { marginTop: "2mm", marginHorizontal: "2mm", fontSize: 9, color: GREY },

  checks: {
    paddingVertical: "4mm",
    paddingHorizontal: "6mm",
    backgroundColor: BEIGE,
    borderWidth: 0.6,
    borderColor: BEIGE_LINE,
    fontSize: 10,
  },
  checkRow: { flexDirection: "row", gap: "8mm", marginBottom: "0.6mm" },
  checkCell: { flex: 1, flexDirection: "row", gap: "1.5mm" },
  checkIcon: { width: 8, height: 8, marginTop: 3 },

  bank: { backgroundColor: BEIGE, borderWidth: 0.6, borderColor: "#d9d2c5", fontSize: 10.5 },
  bankRow: { flexDirection: "row" },
  bankCell: {
    flex: 1,
    minHeight: "15mm",
    justifyContent: "center",
    paddingVertical: "2.5mm",
    paddingHorizontal: "6mm",
    borderBottomWidth: 0.6,
    borderBottomColor: "#e2dbcf",
  },
  bankCellLeft: { borderRightWidth: 0.6, borderRightColor: "#e2dbcf" },
  strip: { marginTop: "4mm", marginHorizontal: "6mm", fontSize: 12, color: INK_NAVY },
  stripSoft: { marginTop: "0.5mm", marginHorizontal: "6mm", fontSize: 12, color: GREY },

  ref: { marginTop: "6mm", marginHorizontal: "2mm", fontSize: 8, color: "#9ca3af" },

  // pasted rich text (overview, terms)
  rich: { paddingHorizontal: "2mm" },
  richBlock: { marginBottom: "2.2mm" },
  richH1: { fontSize: 11.5, fontWeight: 700, color: INK_NAVY },
  richH2: { marginTop: "1mm", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, color: INK_NAVY },
  richRule: { height: 0.75, backgroundColor: GOLD, marginVertical: "1mm" },
  richTh: { flex: 1, paddingVertical: "2mm", paddingHorizontal: "4mm", backgroundColor: TABLE_NAVY, color: "#fff", fontWeight: 700 },
  richTd: {
    flex: 1,
    paddingVertical: "1.6mm",
    paddingHorizontal: "4mm",
    backgroundColor: BEIGE,
    borderBottomWidth: 0.6,
    borderBottomColor: "#fbf9f6",
  },
})

// ---------------------------------------------------------------- images

type PdfImage = { data: Buffer; format: "jpg" }

/**
 * react-pdf only reads JPEG and PNG, and uploads may be WebP, AVIF, GIF or BMP,
 * so every photo goes through sharp: rotated upright, capped in size (keeps the
 * file small) and re-encoded as JPEG. A photo that can't be read is left out,
 * the same way the on-screen page drops a broken image.
 */
async function loadImage(src: string): Promise<PdfImage | null> {
  try {
    let bytes: Buffer
    const relative = storage.toRelativePath(src)
    if (relative) {
      bytes = await fs.readFile(storage.getAbsolutePath(relative))
    } else if (/^https?:\/\//i.test(src)) {
      const response = await fetch(src, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return null
      bytes = Buffer.from(await response.arrayBuffer())
    } else {
      return null
    }
    const data = await sharp(bytes, { animated: false })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    return { data, format: "jpg" }
  } catch {
    return null
  }
}

async function loadImages(urls: string[]): Promise<Map<string, PdfImage>> {
  const unique = [...new Set(urls)]
  const loaded = await Promise.all(unique.map(async (url) => [url, await loadImage(url)] as const))
  const map = new Map<string, PdfImage>()
  for (const [url, image] of loaded) if (image) map.set(url, image)
  return map
}

// ---------------------------------------------------------------- text helpers

/**
 * Text pasted from WhatsApp or ChatGPT is full of emoji, arrows and box
 * bullets that none of the embedded fonts can draw; they'd print as junk.
 * Arrows become an en dash, box bullets a plain bullet, and anything else
 * outside the fonts' Latin, punctuation and currency coverage is dropped.
 */
function clean(value: string): string
function clean(value: string | null): string | null
function clean(value: string | null): string | null {
  if (value == null) return value
  return value
    .replace(/[←-⇿⟰-⟿⤀-⥿⬀-⯿➔-➿]/g, "–")
    .replace(/[■-◿•∙❖⬤]/g, "•")
    .replace(/[​-‏⁠-⁯︀-️⃣]/g, "")
    .replace(/[^\t\n\r -ɏḀ-ỿ -⁯₠-⃀™]/gu, "")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
}

/** Every piece of staff-typed text, run through `clean`. URLs are left alone. */
function cleanData(data: ItineraryDocumentData): ItineraryDocumentData {
  const { itinerary } = data
  return {
    itinerary: {
      ...itinerary,
      title: clean(itinerary.title),
      destination: clean(itinerary.destination),
      summary: clean(itinerary.summary),
      termsAndConditions: clean(itinerary.termsAndConditions),
      inclusions: itinerary.inclusions?.map((item) => clean(item)) ?? null,
      exclusions: itinerary.exclusions?.map((item) => clean(item)) ?? null,
    },
    days: data.days.map((day) => ({
      ...day,
      title: clean(day.title),
      description: clean(day.description),
      hotelName: clean(day.hotelName),
      hotelCity: clean(day.hotelCity),
      stayNote: clean(day.stayNote),
    })),
    images: data.images.map((image) => ({ ...image, caption: clean(image.caption) })),
  }
}

/** **bold** and *italic* runs; unmatched markers are dropped, as on screen. */
function Inline({ text }: { text: string }) {
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g
  const plain = (value: string) => value.replace(/\*\*|__/g, "")
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(plain(text.slice(last, match.index)))
    const bold = match[1] ?? match[2]
    parts.push(
      bold !== undefined ? (
        <Text key={match.index} style={{ fontWeight: 700 }}>
          {plain(bold)}
        </Text>
      ) : (
        <Text key={match.index} style={{ fontStyle: "italic" }}>
          {plain(match[3])}
        </Text>
      )
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(plain(text.slice(last)))
  return <>{parts}</>
}

function Bullet({ text, marker = "•" }: { text: string; marker?: string }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>{marker}</Text>
      <Text style={s.bulletText}>
        <Inline text={text} />
      </Text>
    </View>
  )
}

type ViewStyle = Exclude<ComponentProps<typeof View>["style"], unknown[] | undefined>

function RichText({ source, style }: { source: string; style?: ViewStyle }) {
  const blocks = parseRichText(source)
  return (
    <View style={[s.rich, style ?? {}]}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text
                key={index}
                style={[s.richBlock, block.level <= 1 ? s.richH1 : s.richH2]}
                minPresenceAhead={30}
              >
                <Inline text={block.text} />
              </Text>
            )
          case "paragraph":
            return (
              <Text key={index} style={s.richBlock}>
                {block.lines.map((line, n) => (
                  <Text key={n}>
                    {n > 0 ? "\n" : ""}
                    <Inline text={line} />
                  </Text>
                ))}
              </Text>
            )
          case "list":
            return (
              <View key={index} style={s.richBlock}>
                {block.items.map((item, n) => (
                  <Bullet key={n} text={item} marker={block.ordered ? `${n + 1}.` : "•"} />
                ))}
              </View>
            )
          case "table": {
            const width = Math.max(block.head?.length ?? 0, ...block.rows.map((row) => row.length))
            const fill = (row: string[]) => [...row, ...Array(width - row.length).fill("")]
            return (
              <View key={index} style={s.richBlock}>
                {block.head && (
                  <View style={s.tr} wrap={false}>
                    {fill(block.head).map((cell, n) => (
                      <Text key={n} style={s.richTh}>
                        <Inline text={cell} />
                      </Text>
                    ))}
                  </View>
                )}
                {block.rows.map((row, r) => (
                  <View key={r} style={s.tr} wrap={false}>
                    {fill(row).map((cell, n) => (
                      <Text key={n} style={s.richTd}>
                        <Inline text={cell} />
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )
          }
          case "rule":
            return <View key={index} style={s.richRule} />
        }
      })}
    </View>
  )
}

function CheckIcon({ cross = false }: { cross?: boolean }) {
  return (
    <Svg viewBox="0 0 12 12" style={s.checkIcon}>
      <Path
        d={cross ? "M3 3 L9 9 M9 3 L3 9" : "M2 6.5 L5 9.5 L10.5 2.5"}
        stroke={cross ? GREY : INK_NAVY}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <Text style={s.heading} minPresenceAhead={60}>
      {children}
    </Text>
  )
}

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

// ---------------------------------------------------------------- document

function ItineraryPdf({
  data,
  guestName,
  images,
}: {
  data: ItineraryDocumentData
  guestName?: string | null
  images: Map<string, PdfImage>
}) {
  const { itinerary, days } = data
  const nights = itinerary.durationNights
  const daysCount = itinerary.durationDays

  const dayPhotos = new Map<string, string[]>()
  for (const image of data.images) {
    if (!image.dayId || !images.has(image.url)) continue
    dayPhotos.set(image.dayId, [...(dayPhotos.get(image.dayId) ?? []), image.url])
  }
  const gallery = data.images
    .filter((image) => !image.dayId && image.url !== itinerary.coverImageUrl)
    .filter((image) => images.has(image.url))
    .filter((image, index, list) => list.findIndex((o) => o.url === image.url) === index)
    .slice(0, 9)

  const nightRows = buildNightPlan(days, nights)
  const plannedNights = nightRows?.reduce((sum, row) => sum + row.nights, 0) ?? 0

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
    if (itinerary.pricePerAdult) priceRows.push({ label: "Per adult", amount: itinerary.pricePerAdult })
    if (itinerary.pricePerChild) priceRows.push({ label: "Per child", amount: itinerary.pricePerChild })
  }

  const inclusions = itinerary.inclusions?.filter(Boolean) ?? []
  const exclusions = itinerary.exclusions?.filter(Boolean) ?? []
  const places = splitPlaces(itinerary.destination)
  const where = places.length ? places.join(", ") : itinerary.title
  const cover = itinerary.coverImageUrl ? images.get(itinerary.coverImageUrl) : undefined

  return (
    <Document title={`${itinerary.title} – Itinerary`} author={COMPANY.name} creator={COMPANY.name}>
      <Page size="A4" style={s.page}>
        {/* Letterhead, repeated on every sheet. */}
        <View style={s.head} fixed>
          <Svg viewBox={LOGO_VIEWBOX} style={s.logo}>
            {LOGO_PATHS.map((p, i) => (
              <Path key={i} d={p.d} fill={p.fill} />
            ))}
          </Svg>
          <View style={s.contact}>
            <Text>{COMPANY.phone}</Text>
            <Text>{COMPANY.website}</Text>
            <Text>{COMPANY.email}</Text>
          </View>
        </View>

        {/* Gold rule, company name and page number at the foot of every sheet. */}
        <View style={s.foot} fixed>
          <View style={s.footRule} />
          <View style={s.footRow}>
            <Text>FIRST CLASS TOURS &amp; TRAVELS</Text>
            <Text render={({ pageNumber }) => String(pageNumber)} />
          </View>
        </View>

        {/* ------------------------------------------------ cover band */}
        <View style={s.banner}>
          <Text style={s.bannerTitle}>ITINERARY</Text>
          <Text style={s.bannerSub}>
            {nights} NIGHTS / {daysCount} DAYS IN {where.toUpperCase()}
          </Text>
          <Text style={s.bannerTag}>{lead ?? itinerary.title}</Text>
        </View>

        {cover && <Image src={cover} style={s.cover} />}

        <View style={{ marginTop: "2.5mm" }} wrap={false}>
          <View style={s.guestRow}>
            <View style={s.guestCell}>
              <Text>GUEST NAME : {guestName ?? ""}</Text>
            </View>
            <View style={s.guestCell}>
              <Text>
                PACKAGE : {nights} Nights / {daysCount} Days
              </Text>
            </View>
          </View>
          <View style={s.guestRow}>
            <View style={s.guestCell}>
              <Text>ARRIVAL DATE :</Text>
            </View>
            <View style={s.guestCell}>
              <Text>DEPARTURE DATE :</Text>
            </View>
          </View>
        </View>

        {overview && (
          <View>
            <Heading>TOUR OVERVIEW</Heading>
            <RichText source={overview} style={{ fontSize: 10, lineHeight: 1.5 }} />
          </View>
        )}

        {/* ---------------------------------------------- day by day */}
        {days.length > 0 && (
          <View>
            <Heading>YOUR DAY-BY-DAY JOURNEY</Heading>
            {days.map((day) => {
              const bullets = toBullets(day.description)
              const photos = (dayPhotos.get(day.id) ?? []).slice(0, 3)
              const place = day.dayNumber <= nights ? overnightPlace(day) : null
              const stay = [place, day.hotelName, day.stayNote].filter(Boolean)
              const meals = [
                day.breakfast && "Breakfast",
                day.lunch && "Lunch",
                day.dinner && "Dinner",
              ].filter(Boolean)
              // Keep a day on one sheet, as the template does, unless it's too
              // long to fit on one anyway.
              const keepTogether = bullets.join(" ").length < 1600

              return (
                <View key={day.id} style={s.day} wrap={!keepTogether}>
                  <View style={s.dayLabel}>
                    <Text style={s.dayNumber}>DAY {pad(day.dayNumber)}</Text>
                    {titleLines(day.title).map((line, index) => (
                      <Text key={index}>{line}</Text>
                    ))}
                  </View>
                  <View style={s.dayBody}>
                    {bullets.map((bullet, index) => (
                      <Bullet key={index} text={bullet} />
                    ))}
                    {photos.length > 0 && (
                      <View style={s.dayPhotos} wrap={false}>
                        {photos.map((url) => (
                          <Image key={url} src={images.get(url)!} style={s.dayPhoto} />
                        ))}
                      </View>
                    )}
                    {stay.length > 0 && <Text style={s.dayNote}>OVERNIGHT: {stay.join(" · ")}</Text>}
                    {meals.length > 0 && <Text style={s.dayNote}>MEALS: {meals.join(", ")}</Text>}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* --------------------------------------------- night plan */}
        {nightRows && (
          <View wrap={false}>
            <Heading>DESTINATION &amp; NIGHT PLAN</Heading>
            <View style={s.table}>
              <View style={s.tr}>
                <Text style={[s.th, { flex: 1 }]}>DESTINATION</Text>
                <Text style={[s.th, { width: "26%", textAlign: "center" }]}>NIGHTS</Text>
              </View>
              {nightRows.map((row, index) => (
                <View key={index} style={s.tr}>
                  <Text style={[s.td, { flex: 1 }]}>{row.place.toUpperCase()}</Text>
                  <Text style={[s.td, { width: "26%", textAlign: "center" }]}>{pad(row.nights)}</Text>
                </View>
              ))}
              <View style={s.tr}>
                <Text style={[s.td, s.total, { flex: 1 }]}>TOTAL</Text>
                <Text style={[s.td, s.total, { width: "26%", textAlign: "center" }]}>
                  {pad(plannedNights)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ------------------------------------------------ gallery */}
        {gallery.length > 0 && (
          <View>
            <Heading>GLIMPSES OF YOUR JOURNEY</Heading>
            {chunk(gallery, 3).map((row, r) => (
              <View key={r} style={s.galleryRow} wrap={false}>
                {row.map((image) => (
                  <Image key={image.id} src={images.get(image.url)!} style={s.galleryPhoto} />
                ))}
                {Array.from({ length: 3 - row.length }, (_, i) => (
                  <View key={`gap-${i}`} style={s.galleryGap} />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* --------------------------------- pricing (fresh sheet) */}
        <View break>
          <View style={s.topbar} />
          <View style={s.topbarGold} />

          {priceRows.length > 0 && (
            <View wrap={false}>
              <Text style={s.title}>PACKAGE PRICING</Text>
              <View style={s.table}>
                <View style={s.tr}>
                  <Text style={[s.th, { flex: 1 }]}>
                    {itinerary.pricingMode === "per_pax" ? "PRICE PER PERSON" : "PACKAGE"}
                  </Text>
                  <Text style={[s.th, { width: "25%" }]}>AMOUNT</Text>
                </View>
                {priceRows.map((row) => (
                  <View key={row.label} style={s.tr}>
                    <Text style={[s.td, { flex: 1 }]}>{row.label}</Text>
                    <Text style={[s.td, { width: "25%" }]}>{formatMoneyShort(row.amount)}</Text>
                  </View>
                ))}
                {itinerary.pricingMode === "fixed" && itinerary.fixedPrice ? (
                  <View style={s.tr}>
                    <Text style={[s.td, s.total, { flex: 1 }]}>GRAND TOTAL</Text>
                    <Text style={[s.td, s.total, { width: "25%" }]}>
                      {formatMoneyShort(itinerary.fixedPrice)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {itinerary.validUntil && (
                <Text style={s.small}>Price valid till {formatDate(itinerary.validUntil)}.</Text>
              )}
            </View>
          )}

          {inclusions.length > 0 && (
            <View wrap={false}>
              <Heading>PACKAGE INCLUDES</Heading>
              <CheckList items={inclusions} />
            </View>
          )}

          {exclusions.length > 0 && (
            <View wrap={false}>
              <Heading>PACKAGE EXCLUDES</Heading>
              <CheckList items={exclusions} cross />
            </View>
          )}

          <View wrap={false}>
            <Heading>BANK &amp; CONTACT DETAILS</Heading>
            <View style={s.bank}>
              <View style={s.bankRow}>
                <View style={[s.bankCell, s.bankCellLeft]}>
                  <Text>ACCOUNT NAME :</Text>
                  <Text>{COMPANY.bank.accountName}</Text>
                </View>
                <View style={s.bankCell}>
                  <Text>BANK :</Text>
                  <Text>{COMPANY.bank.bankName}</Text>
                </View>
              </View>
              <View style={s.bankRow}>
                <View style={[s.bankCell, s.bankCellLeft]}>
                  <Text>ACCOUNT NUMBER : {COMPANY.bank.accountNumber}</Text>
                </View>
                <View style={s.bankCell}>
                  <Text>IFSC CODE {COMPANY.bank.ifsc}</Text>
                </View>
              </View>
            </View>
            <Text style={s.strip}>
              FIRST CLASS TOURS &amp; TRAVELS | {COMPANY.contactPhones.join(" | ")}
            </Text>
            <Text style={s.stripSoft}>
              {COMPANY.email} | {COMPANY.website}
            </Text>
          </View>

          {itinerary.termsAndConditions && (
            <View>
              <Heading>TERMS &amp; CONDITIONS</Heading>
              <RichText
                source={itinerary.termsAndConditions}
                style={{ fontSize: 8.5, lineHeight: 1.5, color: "#4b5563" }}
              />
            </View>
          )}

          <Text style={s.ref}>Reference {itinerary.code}</Text>
        </View>
      </Page>
    </Document>
  )
}

function CheckList({ items, cross = false }: { items: string[]; cross?: boolean }) {
  return (
    <View style={s.checks}>
      {chunk(items, 2).map((pair, r) => (
        <View key={r} style={s.checkRow}>
          {pair.map((item, n) => (
            <View key={n} style={s.checkCell}>
              <CheckIcon cross={cross} />
              <Text style={{ flex: 1 }}>
                <Inline text={item} />
              </Text>
            </View>
          ))}
          {pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  )
}

/** Renders the itinerary to PDF bytes. */
export async function renderItineraryPdf(
  data: ItineraryDocumentData,
  { guestName }: { guestName?: string | null } = {}
): Promise<Buffer> {
  const urls = [
    ...(data.itinerary.coverImageUrl ? [data.itinerary.coverImageUrl] : []),
    ...data.images.map((image) => image.url),
  ]
  const images = await loadImages(urls)
  return renderToBuffer(
    <ItineraryPdf data={cleanData(data)} guestName={guestName ? clean(guestName) : null} images={images} />
  )
}

/** A download response with a readable, filesystem-safe file name. */
export function pdfResponse(bytes: Uint8Array, name: string): Response {
  const safe = name.replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim() || "itinerary"
  const file = `${safe}.pdf`
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  })
}

/** Common failure handling for the download routes. */
export function pdfFailure(error: unknown): Response {
  console.error("[pdf] render failed", error)
  return new Response("Could not generate the PDF. Please try again.", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
