"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, AuthorizationError, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { nextBookingCode } from "@/lib/codes"
import { computeTotals, percentToBps } from "@/lib/money"
import { canViewAll } from "@/lib/rbac"
import * as service from "@/lib/services/booking.service"
import * as leadService from "@/lib/services/lead.service"
import { uuidSchema } from "@/validations/common.validation"
import {
  BookingListParamsSchema,
  BookingPaxSchema,
  CancelBookingSchema,
  CreateBookingSchema,
  DeleteBookingSchema,
  DeletePaxSchema,
  DeleteTripCostSchema,
  TripCostFormSchema,
  UpdateBookingSchema,
  UpdateBookingStatusSchema,
  UpdateTripCostSchema,
} from "@/validations/booking.validation"
import type { SessionPayload } from "@/types/auth"

function scopeFor(session: SessionPayload): string | null {
  return canViewAll(session.role, "booking") ? null : session.userId
}

/**
 * `scopeFor` restricts list views to a sales user's own pipeline, but a
 * per-record action reached by id has to re-apply the same restriction
 * itself — otherwise a sales user can act on any booking by id/URL even
 * though it's filtered out of their own list view.
 */
function assertBookingInScope(
  session: SessionPayload,
  booking: { assignedTo: string | null }
): void {
  const scope = scopeFor(session)
  if (scope && booking.assignedTo !== scope) {
    throw new AuthorizationError()
  }
}

/**
 * Derives the money columns from the form.
 *
 * Per-pax pricing is expanded here rather than in the UI so the stored subtotal
 * always matches the head count, and `computeTotals` is the same helper the
 * invoice generator uses — the two can never disagree.
 */
function priceBooking(input: z.output<typeof CreateBookingSchema>) {
  const subtotal =
    input.pricingMode === "per_pax"
      ? (input.pricePerAdult ?? 0) * input.adults +
        (input.pricePerChild ?? 0) * input.children
      : input.sellSubtotal

  const totals = computeTotals({
    subtotal,
    discount: input.discount,
    taxRateBps: percentToBps(input.taxRatePercent),
  })

  return {
    pricingMode: input.pricingMode,
    pricePerAdult: input.pricePerAdult ?? null,
    pricePerChild: input.pricePerChild ?? null,
    sellSubtotal: totals.subtotal,
    discount: totals.discount,
    taxRateBps: totals.taxRateBps,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
  }
}

export const fetchBookings = defineAction({
  name: "fetchBookings",
  permission: "booking:view",
  schema: BookingListParamsSchema,
  handler: async (params, { session }) =>
    service.listBookings(params, scopeFor(session)),
})

export const fetchBooking = defineAction({
  name: "fetchBooking",
  permission: "booking:view",
  schema: z.object({ id: uuidSchema }),
  handler: async ({ id }, { session }) => {
    const raw = await service.getBookingRaw(id)
    if (!raw) throw new ActionFailure("Booking not found")
    assertBookingInScope(session, raw)

    const booking = await service.getBooking(id)
    if (!booking) throw new ActionFailure("Booking not found")
    return booking
  },
})

export const fetchBookingOptions = defineAction({
  name: "fetchBookingOptions",
  permission: "booking:view",
  schema: z.object({ search: z.string().optional() }),
  handler: async ({ search }) => service.getBookingOptions(search),
})

export const fetchBookingLedger = defineAction({
  name: "fetchBookingLedger",
  permission: "booking:view",
  schema: z.object({ id: uuidSchema }),
  handler: async ({ id }) => service.getBookingLedger(id),
})

export const fetchTripCosts = defineAction({
  name: "fetchTripCosts",
  permission: "cost:view",
  schema: z.object({ bookingId: uuidSchema }),
  handler: async ({ bookingId }) => service.listTripCosts(bookingId),
})

export const fetchPax = defineAction({
  name: "fetchPax",
  permission: "booking:view",
  schema: z.object({ bookingId: uuidSchema }),
  handler: async ({ bookingId }) => service.listPax(bookingId),
})

export const createBooking = defineAction({
  name: "createBooking",
  permission: "booking:create",
  schema: CreateBookingSchema,
  handler: async (input, { session }) => {
    const code = await nextBookingCode(new Date(input.startDate))

    const booking = await service.createBooking({
      code,
      customerId: input.customerId,
      leadId: input.leadId ?? null,
      itineraryId: input.itineraryId ?? null,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      ...priceBooking(input),
      assignedTo: input.assignedTo ?? session.userId,
      notes: input.notes,
      internalNotes: input.internalNotes,
      createdBy: session.userId,
    })

    // Converting an enquiry marks it won, so the pipeline stays honest.
    if (input.leadId) {
      const lead = await leadService.getLeadRaw(input.leadId)
      if (lead && lead.status !== "won") {
        await leadService.updateLead(input.leadId, {
          status: "won",
          closedAt: new Date(),
        })
        await leadService.logActivity(
          input.leadId,
          "converted",
          `Converted to booking ${code}`,
          session.userId
        )
      }
    }

    await recordAudit({
      entity: "bookings",
      entityId: booking.id,
      action: "create",
      summary: `Created booking ${code}`,
      session,
    })

    revalidatePath("/admin/trips")
    revalidatePath("/admin/leads")
    return booking
  },
})

export const updateBooking = defineAction({
  name: "updateBooking",
  permission: "booking:update",
  schema: UpdateBookingSchema,
  handler: async (input, { session }) => {
    const { id } = input
    const before = await service.getBookingRaw(id)
    if (!before) throw new ActionFailure("Booking not found")
    assertBookingInScope(session, before)
    if (before.status === "cancelled") {
      throw new ActionFailure("A cancelled booking cannot be edited")
    }

    const booking = await service.updateBooking(id, {
      customerId: input.customerId,
      itineraryId: input.itineraryId ?? null,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      ...priceBooking(input),
      assignedTo: input.assignedTo ?? null,
      notes: input.notes,
      internalNotes: input.internalNotes,
    })
    if (!booking) throw new ActionFailure("Booking not found")

    await recordAudit({
      entity: "bookings",
      entityId: id,
      action: "update",
      summary: `Updated booking ${booking.code}`,
      changes: diffChanges(before, booking),
      session,
    })

    revalidatePath("/admin/trips")
    revalidatePath(`/admin/trips/${id}`)
    return booking
  },
})

export const updateBookingStatus = defineAction({
  name: "updateBookingStatus",
  permission: "booking:update",
  schema: UpdateBookingStatusSchema,
  handler: async ({ id, status }, { session }) => {
    const before = await service.getBookingRaw(id)
    if (!before) throw new ActionFailure("Booking not found")
    assertBookingInScope(session, before)
    if (before.status === "cancelled") {
      throw new ActionFailure("A cancelled booking cannot change status")
    }
    if (status === "cancelled") {
      throw new ActionFailure("Use the cancel action so a reason is recorded")
    }

    const booking = await service.updateBooking(id, {
      status,
      completedAt: status === "completed" ? new Date() : null,
    })

    await recordAudit({
      entity: "bookings",
      entityId: id,
      action: "status_change",
      summary: `${before.code}: ${before.status} → ${status}`,
      changes: { status: { from: before.status, to: status } },
      session,
    })

    revalidatePath("/admin/trips")
    revalidatePath(`/admin/trips/${id}`)
    return booking
  },
})

export const cancelBooking = defineAction({
  name: "cancelBooking",
  permission: "booking:cancel",
  schema: CancelBookingSchema,
  handler: async ({ id, cancellationReason, cancellationCharge }, { session }) => {
    const before = await service.getBookingRaw(id)
    if (!before) throw new ActionFailure("Booking not found")
    assertBookingInScope(session, before)
    if (before.status === "cancelled") {
      throw new ActionFailure("This booking is already cancelled")
    }

    const booking = await service.updateBooking(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason,
      cancellationCharge: cancellationCharge ?? null,
    })

    await recordAudit({
      entity: "bookings",
      entityId: id,
      action: "cancel",
      summary: `Cancelled booking ${before.code} — ${cancellationReason}`,
      session,
    })

    revalidatePath("/admin/trips")
    revalidatePath(`/admin/trips/${id}`)
    return booking
  },
})

export const deleteBooking = defineAction({
  name: "deleteBooking",
  permission: "booking:delete",
  schema: DeleteBookingSchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getBookingRaw(id)
    if (!before) throw new ActionFailure("Booking not found")
    assertBookingInScope(session, before)

    const ledger = await service.getBookingLedger(id)
    if (ledger.received > 0) {
      throw new ActionFailure(
        "Money has been received against this booking — cancel it instead of deleting"
      )
    }

    await service.softDeleteBooking(id)
    await recordAudit({
      entity: "bookings",
      entityId: id,
      action: "delete",
      summary: `Deleted booking ${before.code}`,
      session,
    })
    revalidatePath("/admin/trips")
    return { id }
  },
})

// ------------------------------------------------------------- trip costing

export const createTripCost = defineAction({
  name: "createTripCost",
  permission: "cost:create",
  schema: TripCostFormSchema,
  handler: async (input, { session }) => {
    const item = await service.createTripCost({
      ...input,
      supplierId: input.supplierId ?? null,
      vehicleId: input.vehicleId ?? null,
      // Denormalised so every report reads a stored number instead of recomputing.
      costAmount: input.unitCost * input.quantity,
      createdBy: session.userId,
    })

    await recordAudit({
      entity: "trip_cost_items",
      entityId: item.id,
      action: "create",
      summary: `Added ${input.category} cost: ${input.description}`,
      session,
    })

    revalidatePath(`/admin/trips/${input.bookingId}`)
    return item
  },
})

export const updateTripCost = defineAction({
  name: "updateTripCost",
  permission: "cost:update",
  schema: UpdateTripCostSchema,
  handler: async ({ id, ...input }, { session }) => {
    const before = await service.getTripCost(id)
    if (!before) throw new ActionFailure("Cost line not found")

    const costAmount = input.unitCost * input.quantity
    if (costAmount < before.paidAmount) {
      throw new ActionFailure(
        "Cost cannot be lower than what has already been paid to the supplier"
      )
    }

    const item = await service.updateTripCost(id, {
      ...input,
      supplierId: input.supplierId ?? null,
      vehicleId: input.vehicleId ?? null,
      costAmount,
    })
    if (!item) throw new ActionFailure("Cost line not found")

    await recordAudit({
      entity: "trip_cost_items",
      entityId: id,
      action: "update",
      summary: `Updated cost line: ${input.description}`,
      changes: diffChanges(before, item),
      session,
    })

    revalidatePath(`/admin/trips/${input.bookingId}`)
    return item
  },
})

export const deleteTripCost = defineAction({
  name: "deleteTripCost",
  permission: "cost:delete",
  schema: DeleteTripCostSchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getTripCost(id)
    if (!before) throw new ActionFailure("Cost line not found")
    if (before.paidAmount > 0) {
      throw new ActionFailure(
        "This line has supplier payments against it and cannot be deleted"
      )
    }

    await service.softDeleteTripCost(id)
    await recordAudit({
      entity: "trip_cost_items",
      entityId: id,
      action: "delete",
      summary: `Removed cost line: ${before.description}`,
      session,
    })
    revalidatePath(`/admin/trips/${before.bookingId}`)
    return { id }
  },
})

// ------------------------------------------------------------------ pax list

export const addPax = defineAction({
  name: "addPax",
  permission: "booking:update",
  schema: BookingPaxSchema,
  handler: async (input) => {
    const pax = await service.createPax({
      ...input,
      age: input.age ?? null,
    })
    revalidatePath(`/admin/trips/${input.bookingId}`)
    return pax
  },
})

export const removePax = defineAction({
  name: "removePax",
  permission: "booking:update",
  schema: DeletePaxSchema,
  handler: async ({ id }) => {
    const deleted = await service.deletePax(id)
    if (deleted) revalidatePath(`/admin/trips/${deleted.bookingId}`)
    return { id }
  },
})
