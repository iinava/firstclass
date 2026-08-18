import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listVehicles } from "@/lib/services/vehicle.service"
import { VehicleListParamsSchema } from "@/validations/vehicle.validation"
import { FleetView } from "./_components/fleet-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Fleet" }

export default function FleetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Fleet"
        description="Vehicles and drivers, with expiry tracking and per-trip cost."
      />
      <Suspense fallback={<TableSkeleton />}>
        <FleetLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function FleetLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("vehicle:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(VehicleListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortBy: str("sortBy") ?? "createdAt",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    type: str("type"),
    ownership: str("ownership"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.vehicles.list(params),
    queryFn: () => listVehicles(params),
  })

  return (
    <Hydrate client={queryClient}>
      <FleetView />
    </Hydrate>
  )
}
