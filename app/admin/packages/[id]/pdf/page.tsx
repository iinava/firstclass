import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requirePermission } from "@/lib/action"
import { getCustomer } from "@/lib/services/customer.service"
import { getItineraryDetail } from "@/lib/services/itinerary.service"
import { ItineraryDocument } from "@/components/print/itinerary-document"
import { PrintToolbar } from "@/components/print/print-toolbar"

export const metadata: Metadata = { title: "Itinerary PDF" }

/**
 * Staff copy of the itinerary PDF. Unlike the public one it works for drafts
 * (so a quote can be checked before it's sent) and fills in the guest's name
 * when the quote is linked to a customer.
 */
export default async function ItineraryPdfPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission("itinerary:view")
  const { id } = await params

  const detail = await getItineraryDetail(id)
  if (!detail) notFound()

  const customer = detail.itinerary.customerId
    ? await getCustomer(detail.itinerary.customerId)
    : null

  return (
    <div className="bg-neutral-200 p-6 print:bg-white print:p-0 dark:bg-neutral-900">
      <PrintToolbar
        downloadHref={`/admin/packages/${id}/pdf/download`}
        backHref={`/admin/packages/${id}`}
        backLabel="Back to itinerary"
      />
      <div className="shadow-lg print:shadow-none">
        <ItineraryDocument data={detail} guestName={customer?.name} />
      </div>
    </div>
  )
}
