import "server-only"
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { customers } from "@/db/schemas/customer.schema"
import {
  itineraries,
  itineraryDays,
  itineraryImages,
  type Itinerary,
  type ItineraryDay,
} from "@/db/schemas/itinerary.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { ItineraryListParams } from "@/validations/itinerary.validation"

const alive = isNull(itineraries.deletedAt)

export interface ItineraryListRow extends Itinerary {
  customerName: string | null
  dayCount: number
  imageCount: number
}

export async function listItineraries(
  params: ItineraryListParams
): Promise<PaginatedResult<ItineraryListRow>> {
  const { page, pageSize, search, sortDir, kind, status } = params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(
        ilike(itineraries.title, term),
        ilike(itineraries.code, term),
        ilike(itineraries.destination, term)
      )!
    )
  }
  if (kind) filters.push(eq(itineraries.kind, kind))
  if (status) filters.push(eq(itineraries.status, status))

  const where = and(...filters)
  const order =
    sortDir === "asc" ? asc(itineraries.createdAt) : desc(itineraries.createdAt)

  const rowsPromise = db
    .select({
      id: itineraries.id,
      code: itineraries.code,
      kind: itineraries.kind,
      title: itineraries.title,
      shareToken: itineraries.shareToken,
      isShareEnabled: itineraries.isShareEnabled,
      leadId: itineraries.leadId,
      customerId: itineraries.customerId,
      sourcePackageId: itineraries.sourcePackageId,
      version: itineraries.version,
      parentItineraryId: itineraries.parentItineraryId,
      destination: itineraries.destination,
      durationDays: itineraries.durationDays,
      durationNights: itineraries.durationNights,
      summary: itineraries.summary,
      coverImageUrl: itineraries.coverImageUrl,
      pricingMode: itineraries.pricingMode,
      pricePerAdult: itineraries.pricePerAdult,
      pricePerChild: itineraries.pricePerChild,
      fixedPrice: itineraries.fixedPrice,
      estimatedCost: itineraries.estimatedCost,
      inclusions: itineraries.inclusions,
      exclusions: itineraries.exclusions,
      termsAndConditions: itineraries.termsAndConditions,
      status: itineraries.status,
      validUntil: itineraries.validUntil,
      sentAt: itineraries.sentAt,
      respondedAt: itineraries.respondedAt,
      viewCount: itineraries.viewCount,
      lastViewedAt: itineraries.lastViewedAt,
      createdBy: itineraries.createdBy,
      createdAt: itineraries.createdAt,
      updatedAt: itineraries.updatedAt,
      deletedAt: itineraries.deletedAt,
      customerName: customers.name,
      dayCount: sql<number>`(
        select count(*)::int from ${itineraryDays}
        where ${itineraryDays.itineraryId} = "itineraries"."id"
      )`,
      imageCount: sql<number>`(
        select count(*)::int from ${itineraryImages}
        where ${itineraryImages.itineraryId} = "itineraries"."id"
      )`,
    })
    .from(itineraries)
    .leftJoin(customers, eq(customers.id, itineraries.customerId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(itineraries).where(where)
  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows as ItineraryListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Packages for the "convert to trip" picker — published, reusable products. */
export async function getPackageOptions() {
  return db
    .select({
      id: itineraries.id,
      code: itineraries.code,
      title: itineraries.title,
      destination: itineraries.destination,
      durationDays: itineraries.durationDays,
      durationNights: itineraries.durationNights,
    })
    .from(itineraries)
    .where(and(alive, eq(itineraries.kind, "package")))
    .orderBy(desc(itineraries.createdAt))
    .limit(300)
}

export async function getItinerary(id: string): Promise<Itinerary | null> {
  const [row] = await db
    .select()
    .from(itineraries)
    .where(and(eq(itineraries.id, id), alive))
    .limit(1)
  return row ?? null
}

/** Full document for the public share page and the editor preview. */
export async function getItineraryDetail(id: string) {
  const itinerary = await getItinerary(id)
  if (!itinerary) return null

  const [days, images] = await Promise.all([
    db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, id))
      .orderBy(asc(itineraryDays.dayNumber)),
    db
      .select()
      .from(itineraryImages)
      .where(eq(itineraryImages.itineraryId, id))
      .orderBy(asc(itineraryImages.sortOrder)),
  ])

  return { itinerary, days, images }
}

/**
 * Public lookup by share token. Only enabled, non-draft, unexpired itineraries
 * resolve — a leaked draft link should not expose unfinished pricing, and a
 * link nobody revoked should still stop working eventually.
 *
 * Selects an explicit column list rather than the whole row, same reasoning
 * as listCatalog: this feeds the public /i/[token] page, so internal fields
 * (leadId, customerId, estimatedCost, viewCount, shareToken itself, ...) must
 * never leak into it by accident when the schema grows.
 */
export async function getItineraryByShareToken(token: string) {
  const [itinerary] = await db
    .select({
      id: itineraries.id,
      code: itineraries.code,
      kind: itineraries.kind,
      title: itineraries.title,
      destination: itineraries.destination,
      durationDays: itineraries.durationDays,
      durationNights: itineraries.durationNights,
      summary: itineraries.summary,
      coverImageUrl: itineraries.coverImageUrl,
      pricingMode: itineraries.pricingMode,
      pricePerAdult: itineraries.pricePerAdult,
      pricePerChild: itineraries.pricePerChild,
      fixedPrice: itineraries.fixedPrice,
      inclusions: itineraries.inclusions,
      exclusions: itineraries.exclusions,
      termsAndConditions: itineraries.termsAndConditions,
      validUntil: itineraries.validUntil,
    })
    .from(itineraries)
    .where(
      and(
        eq(itineraries.shareToken, token),
        eq(itineraries.isShareEnabled, true),
        alive,
        sql`${itineraries.status} <> 'draft'`,
        sql`(${itineraries.shareTokenExpiresAt} is null or ${itineraries.shareTokenExpiresAt} > now())`
      )
    )
    .limit(1)

  if (!itinerary) return null

  const [days, images] = await Promise.all([
    db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, itinerary.id))
      .orderBy(asc(itineraryDays.dayNumber)),
    db
      .select()
      .from(itineraryImages)
      .where(eq(itineraryImages.itineraryId, itinerary.id))
      .orderBy(asc(itineraryImages.sortOrder)),
  ])

  return { itinerary, days, images }
}

export interface CatalogCard {
  code: string
  title: string
  shareToken: string
  destination: string | null
  durationDays: number
  durationNights: number
  summary: string | null
  coverImageUrl: string | null
  pricingMode: "per_pax" | "fixed"
  pricePerAdult: number | null
  fixedPrice: number | null
  /** Gallery shots for the card's photo strip, cover excluded. */
  photos: string[]
  /** Day titles, for the "what you'll do" peek on the card. */
  dayTitles: string[]
}

export interface CatalogFilters {
  search?: string
  destination?: string
  sort?: "price_asc" | "price_desc" | "duration" | "newest"
}

/**
 * Published packages for the public catalogue.
 *
 * Packages only — a `custom` itinerary is one customer's quote and must never
 * appear in a public list, however it is sorted or filtered. Selects an
 * explicit column list rather than the whole row so internal fields
 * (estimatedCost, leadId, viewCount) cannot leak into a public page by
 * accident when the schema grows.
 */
export async function listCatalog(filters: CatalogFilters = {}): Promise<CatalogCard[]> {
  const where = [
    alive,
    eq(itineraries.kind, "package"),
    eq(itineraries.status, "published"),
    eq(itineraries.isShareEnabled, true),
  ]

  if (filters.search) {
    const term = `%${filters.search}%`
    where.push(
      or(
        ilike(itineraries.title, term),
        ilike(itineraries.destination, term),
        ilike(itineraries.summary, term)
      )!
    )
  }
  if (filters.destination) {
    where.push(ilike(itineraries.destination, `%${filters.destination}%`))
  }

  // Per-pax and fixed packages are compared on whichever price applies, so one
  // "price: low to high" is honest across both.
  const effectivePrice = sql`coalesce(${itineraries.pricePerAdult}, ${itineraries.fixedPrice})`
  const order =
    filters.sort === "price_asc"
      ? [sql`${effectivePrice} asc nulls last`]
      : filters.sort === "price_desc"
        ? [sql`${effectivePrice} desc nulls last`]
        : filters.sort === "duration"
          ? [asc(itineraries.durationDays)]
          : [desc(itineraries.createdAt)]

  const rows = await db
    .select({
      id: itineraries.id,
      code: itineraries.code,
      title: itineraries.title,
      shareToken: itineraries.shareToken,
      destination: itineraries.destination,
      durationDays: itineraries.durationDays,
      durationNights: itineraries.durationNights,
      summary: itineraries.summary,
      coverImageUrl: itineraries.coverImageUrl,
      pricingMode: itineraries.pricingMode,
      pricePerAdult: itineraries.pricePerAdult,
      fixedPrice: itineraries.fixedPrice,
    })
    .from(itineraries)
    .where(and(...where))
    .orderBy(...order)
    .limit(60)

  if (rows.length === 0) return []

  // Photos and day titles in two grouped queries rather than one per card.
  const ids = rows.map((r) => r.id)
  const [photoRows, dayRows] = await Promise.all([
    db
      .select({ itineraryId: itineraryImages.itineraryId, url: itineraryImages.url })
      .from(itineraryImages)
      .where(inArray(itineraryImages.itineraryId, ids))
      .orderBy(asc(itineraryImages.sortOrder)),
    db
      .select({
        itineraryId: itineraryDays.itineraryId,
        title: itineraryDays.title,
        dayNumber: itineraryDays.dayNumber,
      })
      .from(itineraryDays)
      .where(inArray(itineraryDays.itineraryId, ids))
      .orderBy(asc(itineraryDays.dayNumber)),
  ])

  const photosBy = new Map<string, string[]>()
  for (const photo of photoRows) {
    const list = photosBy.get(photo.itineraryId) ?? []
    if (list.length < 6) list.push(photo.url)
    photosBy.set(photo.itineraryId, list)
  }
  const daysBy = new Map<string, string[]>()
  for (const day of dayRows) {
    const list = daysBy.get(day.itineraryId) ?? []
    list.push(day.title)
    daysBy.set(day.itineraryId, list)
  }

  // The id is dropped here: it is only needed to group the two queries above,
  // and the public page has no use for an internal identifier.
  return rows.map(({ id, ...card }) => ({
    ...card,
    photos: (photosBy.get(id) ?? []).filter((url) => url !== card.coverImageUrl),
    dayTitles: daysBy.get(id) ?? [],
  }))
}

/** Destinations that actually have a published package, for the filter row. */
export async function listCatalogDestinations(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ destination: itineraries.destination })
    .from(itineraries)
    .where(
      and(
        alive,
        eq(itineraries.kind, "package"),
        eq(itineraries.status, "published"),
        eq(itineraries.isShareEnabled, true),
        sql`${itineraries.destination} is not null`
      )
    )

  // Destinations are stored as "Munnar, Alleppey" — split so a customer can
  // filter by the one place they care about.
  const places = new Set<string>()
  for (const row of rows) {
    for (const part of (row.destination ?? "").split(",")) {
      const place = part.trim()
      if (place) places.add(place)
    }
  }
  return [...places].sort((a, b) => a.localeCompare(b))
}

/** Fire-and-forget view counter for the public page. */
export async function recordItineraryView(id: string): Promise<void> {
  await db
    .update(itineraries)
    .set({
      viewCount: sql`${itineraries.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(itineraries.id, id))
}

export async function createItinerary(
  values: typeof itineraries.$inferInsert
): Promise<Itinerary> {
  const [row] = await db.insert(itineraries).values(values).returning()
  return row
}

export async function updateItinerary(
  id: string,
  values: Partial<typeof itineraries.$inferInsert>
): Promise<Itinerary | null> {
  const [row] = await db
    .update(itineraries)
    .set(values)
    .where(and(eq(itineraries.id, id), alive))
    .returning()
  return row ?? null
}

export async function softDeleteItinerary(id: string): Promise<void> {
  await db
    .update(itineraries)
    .set({ deletedAt: new Date() })
    .where(and(eq(itineraries.id, id), alive))
}

// ---------------------------------------------------------------------- days

export async function listDays(itineraryId: string): Promise<ItineraryDay[]> {
  return db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.itineraryId, itineraryId))
    .orderBy(asc(itineraryDays.dayNumber))
}

export async function upsertDay(values: typeof itineraryDays.$inferInsert) {
  const [row] = await db
    .insert(itineraryDays)
    .values(values)
    .onConflictDoUpdate({
      target: [itineraryDays.itineraryId, itineraryDays.dayNumber],
      set: {
        title: values.title,
        description: values.description,
        stayNote: values.stayNote,
        breakfast: values.breakfast,
        lunch: values.lunch,
        dinner: values.dinner,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

export async function updateDay(
  id: string,
  values: Partial<typeof itineraryDays.$inferInsert>
) {
  const [row] = await db
    .update(itineraryDays)
    .set(values)
    .where(eq(itineraryDays.id, id))
    .returning()
  return row ?? null
}

export async function deleteDay(id: string): Promise<ItineraryDay | null> {
  const [row] = await db.delete(itineraryDays).where(eq(itineraryDays.id, id)).returning()
  return row ?? null
}

// -------------------------------------------------------------------- images

export async function countImages(itineraryId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(itineraryImages)
    .where(eq(itineraryImages.itineraryId, itineraryId))
  return row?.value ?? 0
}

export async function addImage(values: typeof itineraryImages.$inferInsert) {
  const [row] = await db.insert(itineraryImages).values(values).returning()
  return row
}

/** Returns the deleted row so the caller can unlink the file it pointed at. */
export async function deleteImage(id: string) {
  const [row] = await db
    .delete(itineraryImages)
    .where(eq(itineraryImages.id, id))
    .returning()
  return row ?? null
}

/**
 * How many live itineraries still use this cover image.
 *
 * `cloneItinerary` copies `coverImageUrl` verbatim, so two rows can share one
 * file — replacing the cover on one of them must not unlink the file the other
 * is still rendering.
 */
export async function countCoverImageUses(url: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(itineraries)
    .where(and(alive, eq(itineraries.coverImageUrl, url)))
  return row?.value ?? 0
}

/** Copies a package (with its days) into a new itinerary for a customer. */
export async function cloneItinerary(
  sourceId: string,
  overrides: Partial<typeof itineraries.$inferInsert>
): Promise<Itinerary | null> {
  const source = await getItinerary(sourceId)
  if (!source) return null

  const days = await listDays(sourceId)

  const [clone] = await db
    .insert(itineraries)
    .values({
      ...source,
      id: undefined,
      code: overrides.code!,
      shareToken: overrides.shareToken!,
      kind: "custom",
      status: "draft",
      version: 1,
      parentItineraryId: null,
      sourcePackageId: source.kind === "package" ? source.id : source.sourcePackageId,
      viewCount: 0,
      lastViewedAt: null,
      sentAt: null,
      respondedAt: null,
      createdAt: undefined,
      updatedAt: undefined,
      ...overrides,
    } as typeof itineraries.$inferInsert)
    .returning()

  if (days.length > 0) {
    await db.insert(itineraryDays).values(
      days.map((day) => ({
        itineraryId: clone.id,
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
        stayNote: day.stayNote,
        breakfast: day.breakfast,
        lunch: day.lunch,
        dinner: day.dinner,
      }))
    )
  }

  return clone
}
