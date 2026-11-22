import { NextResponse, type NextRequest } from "next/server"
import { getItineraryByShareToken } from "@/lib/services/itinerary.service"
import { parsePdfGuestQuery } from "@/validations/pdf.validation"

export const dynamic = "force-dynamic"

/**
 * Customer's PDF download. Same gate as the share page; a link that isn't
 * open goes back to the share page, which explains why. The download form on
 * the share page can send the guest box (name, phone, dates, pax) as query
 * parameters; it's printed as typed and never stored.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/i/[token]/pdf/download">) {
  const { token } = await ctx.params
  const data = await getItineraryByShareToken(token)
  if (!data) return NextResponse.redirect(new URL(`/i/${token}`, request.url))

  // Loaded on demand: react-pdf only needs to be in memory when someone downloads.
  const { pdfFailure, pdfResponse, renderItineraryPdf } = await import("@/lib/pdf/itinerary-pdf")
  try {
    const guest = parsePdfGuestQuery(request.nextUrl.searchParams)
    const bytes = await renderItineraryPdf(data, { guest })
    const forWhom = guest?.name ? ` - ${guest.name}` : ""
    return pdfResponse(bytes, `${data.itinerary.title} - Itinerary${forWhom}`)
  } catch (error) {
    return pdfFailure(error)
  }
}
