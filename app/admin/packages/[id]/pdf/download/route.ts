import type { NextRequest } from "next/server"
import { requirePermission } from "@/lib/action"
import { getCustomer } from "@/lib/services/customer.service"
import { getItineraryDetail } from "@/lib/services/itinerary.service"
import { parsePdfGuestQuery } from "@/validations/pdf.validation"

export const dynamic = "force-dynamic"

/**
 * Staff one-click PDF download, including drafts.
 *
 * The download dialog sends the guest box as query parameters (name, phone,
 * arrival, departure, adults, children) and they're printed as given;
 * `?blank=1` prints the box empty for filling in by hand. A bare link (the
 * preview page's button) keeps the old behaviour: the linked customer's name.
 */
export async function GET(
  request: NextRequest,
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

  const params = request.nextUrl.searchParams

  // Loaded on demand: react-pdf only needs to be in memory when someone downloads.
  const { pdfFailure, pdfResponse, renderItineraryPdf } = await import("@/lib/pdf/itinerary-pdf")
  try {
    let guest = params.get("blank") ? null : parsePdfGuestQuery(params)
    if (!guest && !params.get("blank") && detail.itinerary.customerId) {
      const customer = await getCustomer(detail.itinerary.customerId)
      guest = { name: customer?.name }
    }
    const bytes = await renderItineraryPdf(detail, { guest })
    const forWhom = guest?.name ? ` - ${guest.name}` : ""
    return pdfResponse(bytes, `${detail.itinerary.code} ${detail.itinerary.title}${forWhom}`)
  } catch (error) {
    return pdfFailure(error)
  }
}
