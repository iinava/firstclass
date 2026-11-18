import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ItineraryDocument } from "@/components/print/itinerary-document"
import { PrintToolbar } from "@/components/print/print-toolbar"
import {
  getItineraryByShareToken,
  getUnavailableShareReason,
} from "@/lib/services/itinerary.service"
import { ShareUnavailable } from "../_components/share-unavailable"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  return {
    // The browser offers the title as the PDF's file name.
    title: data ? `${data.itinerary.title} – Itinerary` : "Itinerary unavailable",
    robots: { index: false, follow: false },
  }
}

/**
 * The customer's itinerary laid out as the company's A4 template. This page is
 * the source the PDF download renders (pdf/download), and doubles as an
 * on-screen preview. Same gate as the share page, so a draft or a revoked link
 * can't be printed either.
 */
export default async function SharedItineraryPdfPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getItineraryByShareToken(token)
  if (!data) {
    const reason = await getUnavailableShareReason(token)
    if (reason) return <ShareUnavailable reason={reason} />
    notFound()
  }

  return (
    <div className="min-h-svh w-full bg-neutral-200 p-6 print:bg-white print:p-0">
      <PrintToolbar downloadHref={`/i/${token}/pdf/download`} />
      <div className="shadow-lg print:shadow-none">
        <ItineraryDocument data={data} />
      </div>
    </div>
  )
}
