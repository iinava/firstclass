"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { generateShareToken, nextPackageCode, nextQuoteCode, shareTokenExpiry } from "@/lib/codes"
import * as service from "@/lib/services/itinerary.service"
import { storage } from "@/lib/storage"
import { MAX_IMAGES_PER_ITINERARY } from "@/lib/storage/types"
import { uuidSchema } from "@/validations/common.validation"
import {
  CloneItinerarySchema,
  CreateItinerarySchema,
  DeleteItineraryDaySchema,
  DeleteItineraryImageSchema,
  DeleteItinerarySchema,
  ItineraryDaySchema,
  ItineraryImageSchema,
  ItineraryListParamsSchema,
  ToggleShareSchema,
  UpdateItineraryDaySchema,
  UpdateItinerarySchema,
  UpdateItineraryStatusSchema,
} from "@/validations/itinerary.validation"

/**
 * Unlinks a file that is no longer referenced. Best-effort on purpose: the
 * database is already consistent by this point, so a failed unlink is a
 * housekeeping problem and must not fail the user's save. `storage.delete`
 * ignores anything that isn't ours, so externally hosted URLs pass through.
 *
 * Soft deletes (itineraries, expenses) deliberately keep their files — the
 * record can be restored, and it should still have its pictures.
 */
async function discardFile(url: string | null | undefined) {
  if (!url) return
  try {
    await storage.delete(url)
  } catch (error) {
    console.error("[itineraries] could not remove file", url, error)
  }
}

export const fetchItineraries = defineAction({
  name: "fetchItineraries",
  permission: "itinerary:view",
  schema: ItineraryListParamsSchema,
  handler: async (params) => service.listItineraries(params),
})

export const fetchItineraryDetail = defineAction({
  name: "fetchItineraryDetail",
  permission: "itinerary:view",
  schema: z.object({ id: uuidSchema }),
  handler: async ({ id }) => {
    const detail = await service.getItineraryDetail(id)
    if (!detail) throw new ActionFailure("Itinerary not found")
    return detail
  },
})

export const createItinerary = defineAction({
  name: "createItinerary",
  permission: "itinerary:create",
  schema: CreateItinerarySchema,
  handler: async (input, { session }) => {
    const code = input.kind === "package" ? await nextPackageCode() : await nextQuoteCode()

    const itinerary = await service.createItinerary({
      ...input,
      code,
      shareToken: generateShareToken(),
      shareTokenExpiresAt: shareTokenExpiry(),
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      pricePerAdult: input.pricePerAdult ?? null,
      pricePerChild: input.pricePerChild ?? null,
      fixedPrice: input.fixedPrice ?? null,
      createdBy: session.userId,
    })

    await recordAudit({
      entity: "itineraries",
      entityId: itinerary.id,
      action: "create",
      summary: `Created ${input.kind} ${code}`,
      session,
    })

    revalidatePath("/admin/packages")
    return itinerary
  },
})

export const updateItinerary = defineAction({
  name: "updateItinerary",
  permission: "itinerary:update",
  schema: UpdateItinerarySchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await service.getItinerary(id)
    if (!before) throw new ActionFailure("Itinerary not found")

    const itinerary = await service.updateItinerary(id, {
      ...values,
      leadId: values.leadId ?? null,
      customerId: values.customerId ?? null,
      pricePerAdult: values.pricePerAdult ?? null,
      pricePerChild: values.pricePerChild ?? null,
      fixedPrice: values.fixedPrice ?? null,
    })
    if (!itinerary) throw new ActionFailure("Itinerary not found")

    // The cover was replaced or cleared. `cloneItinerary` copies the URL, so
    // only unlink once no live itinerary points at the old file any more.
    if (before.coverImageUrl && before.coverImageUrl !== itinerary.coverImageUrl) {
      if ((await service.countCoverImageUses(before.coverImageUrl)) === 0) {
        await discardFile(before.coverImageUrl)
      }
    }

    await recordAudit({
      entity: "itineraries",
      entityId: id,
      action: "update",
      summary: `Updated ${itinerary.code}`,
      changes: diffChanges(before, itinerary),
      session,
    })

    revalidatePath("/admin/packages")
    revalidatePath(`/admin/packages/${id}`)
    return itinerary
  },
})

export const updateItineraryStatus = defineAction({
  name: "updateItineraryStatus",
  permission: "itinerary:publish",
  schema: UpdateItineraryStatusSchema,
  handler: async ({ id, status }, { session }) => {
    const before = await service.getItinerary(id)
    if (!before) throw new ActionFailure("Itinerary not found")

    // Publishing something with no days would share an empty page.
    if (status === "published" || status === "sent") {
      const days = await service.listDays(id)
      if (days.length === 0) {
        throw new ActionFailure("Add at least one day before sharing this itinerary")
      }
    }

    const itinerary = await service.updateItinerary(id, {
      status,
      sentAt: status === "sent" ? new Date() : before.sentAt,
      respondedAt:
        status === "accepted" || status === "rejected" ? new Date() : before.respondedAt,
    })

    await recordAudit({
      entity: "itineraries",
      entityId: id,
      action: "status_change",
      summary: `${before.code}: ${before.status} → ${status}`,
      session,
    })

    revalidatePath("/admin/packages")
    return itinerary
  },
})

export const toggleShare = defineAction({
  name: "toggleShare",
  permission: "itinerary:update",
  schema: ToggleShareSchema,
  handler: async ({ id, isShareEnabled }) => {
    const itinerary = await service.updateItinerary(id, { isShareEnabled })
    if (!itinerary) throw new ActionFailure("Itinerary not found")
    revalidatePath("/admin/packages")
    return itinerary
  },
})

/** Issues a fresh share token, killing every previously shared link. */
export const regenerateShareToken = defineAction({
  name: "regenerateShareToken",
  permission: "itinerary:update",
  schema: z.object({ id: uuidSchema }),
  handler: async ({ id }, { session }) => {
    const itinerary = await service.updateItinerary(id, {
      shareToken: generateShareToken(),
      shareTokenExpiresAt: shareTokenExpiry(),
    })
    if (!itinerary) throw new ActionFailure("Itinerary not found")

    await recordAudit({
      entity: "itineraries",
      entityId: id,
      action: "update",
      summary: `Reset share link for ${itinerary.code}`,
      session,
    })
    revalidatePath("/admin/packages")
    return itinerary
  },
})

export const deleteItinerary = defineAction({
  name: "deleteItinerary",
  permission: "itinerary:delete",
  schema: DeleteItinerarySchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getItinerary(id)
    if (!before) throw new ActionFailure("Itinerary not found")

    await service.softDeleteItinerary(id)
    await recordAudit({
      entity: "itineraries",
      entityId: id,
      action: "delete",
      summary: `Deleted ${before.code}`,
      session,
    })
    revalidatePath("/admin/packages")
    return { id }
  },
})

/** Seeds a customer-specific quote from a published package. */
export const cloneItinerary = defineAction({
  name: "cloneItinerary",
  permission: "itinerary:create",
  schema: CloneItinerarySchema,
  handler: async (input, { session }) => {
    const code = await nextQuoteCode()
    const clone = await service.cloneItinerary(input.sourceId, {
      code,
      shareToken: generateShareToken(),
      shareTokenExpiresAt: shareTokenExpiry(),
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      title: input.title ?? undefined,
      createdBy: session.userId,
    })
    if (!clone) throw new ActionFailure("Source itinerary not found")

    await recordAudit({
      entity: "itineraries",
      entityId: clone.id,
      action: "create",
      summary: `Created quote ${code} from a package`,
      session,
    })

    revalidatePath("/admin/packages")
    return clone
  },
})

// ---------------------------------------------------------------------- days

export const saveDay = defineAction({
  name: "saveDay",
  permission: "itinerary:update",
  schema: ItineraryDaySchema,
  handler: async (input) => {
    const day = await service.upsertDay(input)
    revalidatePath(`/admin/packages/${input.itineraryId}`)
    return day
  },
})

export const updateDay = defineAction({
  name: "updateDay",
  permission: "itinerary:update",
  schema: UpdateItineraryDaySchema,
  handler: async ({ id, ...values }) => {
    const day = await service.updateDay(id, values)
    if (!day) throw new ActionFailure("Day not found")
    revalidatePath(`/admin/packages/${values.itineraryId}`)
    return day
  },
})

export const deleteDay = defineAction({
  name: "deleteDay",
  permission: "itinerary:update",
  schema: DeleteItineraryDaySchema,
  handler: async ({ id }) => {
    const day = await service.deleteDay(id)
    if (day) revalidatePath(`/admin/packages/${day.itineraryId}`)
    return { id }
  },
})

// -------------------------------------------------------------------- images

export const addImage = defineAction({
  name: "addImage",
  permission: "itinerary:update",
  schema: ItineraryImageSchema,
  handler: async (input) => {
    const existing = await service.countImages(input.itineraryId)
    if (existing >= MAX_IMAGES_PER_ITINERARY) {
      throw new ActionFailure(
        `An itinerary can hold at most ${MAX_IMAGES_PER_ITINERARY} photos.`
      )
    }

    const image = await service.addImage({
      ...input,
      dayId: input.dayId ?? null,
    })
    revalidatePath(`/admin/packages/${input.itineraryId}`)
    return image
  },
})

export const deleteImage = defineAction({
  name: "deleteImage",
  permission: "itinerary:update",
  schema: DeleteItineraryImageSchema,
  handler: async ({ id }) => {
    const removed = await service.deleteImage(id)
    if (!removed) throw new ActionFailure("Photo not found")

    // Gallery rows are hard-deleted, so the file goes with them.
    await discardFile(removed.url)

    revalidatePath(`/admin/packages/${removed.itineraryId}`)
    return { id }
  },
})
