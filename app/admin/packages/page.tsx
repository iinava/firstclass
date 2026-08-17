import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listItineraries } from "@/lib/services/itinerary.service"
import { ItineraryListParamsSchema } from "@/validations/itinerary.validation"
import { PackagesView } from "./_components/packages-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Packages" }

export default function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Packages & quotes"
        description="Reusable tour packages and customer-specific quotes, both shareable by link."
      />
      <Suspense fallback={<TableSkeleton />}>
        <PackagesLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PackagesLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("itinerary:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(ItineraryListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    kind: str("kind"),
    status: str("status"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.itineraries.list(params),
    queryFn: () => listItineraries(params),
  })

  return (
    <Hydrate client={queryClient}>
      <PackagesView />
    </Hydrate>
  )
}
