import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Hydrate } from "@/components/shared/hydrate"
import { Skeleton } from "@/components/ui/skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { getItineraryDetail } from "@/lib/services/itinerary.service"
import { ItineraryEditor } from "./_components/itinerary-editor"

export const metadata: Metadata = { title: "Itinerary" }

export default function ItineraryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<EditorSkeleton />}>
        <ItineraryLoader params={params} />
      </Suspense>
    </div>
  )
}

async function ItineraryLoader({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("itinerary:view")
  const { id } = await params

  const detail = await getItineraryDetail(id)
  if (!detail) notFound()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.itineraries.detail(id),
    queryFn: () => getItineraryDetail(id),
  })

  return (
    <Hydrate client={queryClient}>
      <ItineraryEditor itineraryId={id} />
    </Hydrate>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
