import { requirePermission } from "@/lib/action"
import { canViewAll } from "@/lib/rbac"
import { getTripItineraryDocument } from "@/lib/services/booking.service"

export const dynamic = "force-dynamic"

/**
 * The trip's itinerary as a PDF for its customer: same layout as the package
 * PDF, with the guest box, day dates and guest list filled from the booking.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/admin/trips/[id]/itinerary/download">
) {
  let session
  try {
    session = await requirePermission("booking:view")
  } catch {
    return new Response("Not allowed", { status: 403 })
  }

  const { id } = await ctx.params
  const trip = await getTripItineraryDocument(id)
  if (!trip) return new Response("Trip not found", { status: 404 })

  // Same rule as the trip actions: without view-all, only your own trips.
  if (!canViewAll(session.role, "booking") && trip.booking.assignedTo !== session.userId) {
    return new Response("Not allowed", { status: 403 })
  }

  // Loaded on demand: react-pdf only needs to be in memory when someone downloads.
  const { pdfFailure, pdfResponse, renderItineraryPdf } = await import("@/lib/pdf/itinerary-pdf")
  try {
    const bytes = await renderItineraryPdf(trip.data, {
      guest: trip.guest,
      passengers: trip.passengers,
    })
    const forWhom = trip.guest.name ? ` - ${trip.guest.name}` : ""
    return pdfResponse(bytes, `${trip.booking.code} ${trip.booking.title}${forWhom}`)
  } catch (error) {
    return pdfFailure(error)
  }
}
