import { requirePermission } from "@/lib/action"
import { getCustomer } from "@/lib/services/customer.service"
import { getItineraryDetail } from "@/lib/services/itinerary.service"

export const dynamic = "force-dynamic"

/**
 * Staff one-click PDF download, including drafts, with the guest's name filled
 * in when the quote is linked to a customer.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/admin/packages/[id]/pdf/download">
) {
  try {
    await requirePermission("itinerary:view")
  } catch {
    return new Response("Not allowed", { status: 403 })
  }

  const { id } = await ctx.params
  const detail = await getItineraryDetail(id)
  if (!detail) return new Response("Itinerary not found", { status: 404 })

  // Loaded on demand: react-pdf only needs to be in memory when someone downloads.
  const { pdfFailure, pdfResponse, renderItineraryPdf } = await import("@/lib/pdf/itinerary-pdf")
  try {
    const customer = detail.itinerary.customerId
      ? await getCustomer(detail.itinerary.customerId)
      : null
    const bytes = await renderItineraryPdf(detail, { guestName: customer?.name })
    return pdfResponse(bytes, `${detail.itinerary.code} ${detail.itinerary.title}`)
  } catch (error) {
    return pdfFailure(error)
  }
}
