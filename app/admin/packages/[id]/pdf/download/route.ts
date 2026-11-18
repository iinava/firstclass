import type { NextRequest } from "next/server"
import { requirePermission } from "@/lib/action"
import { getItinerary } from "@/lib/services/itinerary.service"
import { pdfFailure, pdfResponse, renderOrigin, renderPdf } from "@/lib/pdf/render-pdf"

export const dynamic = "force-dynamic"

/**
 * Staff one-click PDF download, including drafts. The renderer carries the
 * caller's own session to the admin print page, so it sees exactly what the
 * caller is allowed to see.
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
  const itinerary = await getItinerary(id)
  if (!itinerary) return new Response("Itinerary not found", { status: 404 })

  try {
    const bytes = await renderPdf(`${renderOrigin(request)}/admin/packages/${id}/pdf`, {
      cookies: request.cookies.getAll(),
    })
    return pdfResponse(bytes, `${itinerary.code} ${itinerary.title}`)
  } catch (error) {
    return pdfFailure(error)
  }
}
