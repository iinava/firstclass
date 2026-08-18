import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { canViewAll } from "@/lib/rbac"
import { listBookings } from "@/lib/services/booking.service"
import { BookingListParamsSchema } from "@/validations/booking.validation"
import { TripsView } from "./_components/trips-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Trips" }

export default function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Trips"
        description="Every confirmed trip and what is still to collect."
      />
      <Suspense fallback={<TableSkeleton />}>
        <TripsLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TripsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission("booking:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(BookingListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortBy: str("sortBy") ?? "startDate",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    status: str("status"),
    from: str("from"),
    to: str("to"),
  })

  const scope = canViewAll(session.role, "booking") ? null : session.userId
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.bookings.list(params),
    queryFn: () => listBookings(params, scope),
  })

  return (
    <Hydrate client={queryClient}>
      <TripsView />
    </Hydrate>
  )
}
