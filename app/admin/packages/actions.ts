"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { generateShareToken, nextPackageCode, nextQuoteCode } from "@/lib/codes"
import * as service from "@/lib/services/itinerary.service"
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
    await service.deleteDay(id)
    return { id }
  },
})

// -------------------------------------------------------------------- images

export const addImage = defineAction({
  name: "addImage",
  permission: "itinerary:update",
  schema: ItineraryImageSchema,
  handler: async (input) => {
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
    await service.deleteImage(id)
    return { id }
  },
})
