import { NextResponse, type NextRequest } from "next/server"
import { getItineraryByShareToken } from "@/lib/services/itinerary.service"
import { pdfFailure, pdfResponse, renderOrigin, renderPdf } from "@/lib/pdf/render-pdf"

export const dynamic = "force-dynamic"

/**
 * Customer's one-click PDF download. Same gate as the share page; a link that
 * isn't open goes back to the share page, which explains why.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/i/[token]/pdf/download">) {
  const { token } = await ctx.params
  const data = await getItineraryByShareToken(token)
  if (!data) return NextResponse.redirect(new URL(`/i/${token}`, request.url))

  try {
    const bytes = await renderPdf(`${renderOrigin(request)}/i/${token}/pdf`)
    return pdfResponse(bytes, `${data.itinerary.title} - Itinerary`)
  } catch (error) {
    return pdfFailure(error)
  }
}
