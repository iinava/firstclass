import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import {
  getExpenseByCategory,
  getProfitLoss,
  getRevenueByTrip,
} from "@/lib/services/report.service"
import { ReportParamsSchema } from "@/validations/accounts.validation"
import { ReportsView } from "./_components/reports-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Reports"
        description="Revenue, cost and profit by trip, category, supplier and staff."
      />
      <Suspense fallback={<TableSkeleton withTiles />}>
        <ReportsLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ReportsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Company-wide P&L, so this needs the financial permission — `report:view`
  // alone (sales/ops) is not enough to see margins and supplier spend.
  await requirePermission("report:financial")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(ReportParamsSchema, {
    from: str("from"),
    to: str("to"),
    groupBy: str("groupBy") ?? "trip",
  })

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.reports.profitLoss(params),
      queryFn: () => getProfitLoss(params),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.reports.dashboard({ ...params, view: "trip" }),
      queryFn: () => getRevenueByTrip(params),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.reports.byCategory(params),
      queryFn: () => getExpenseByCategory(params),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <ReportsView />
    </Hydrate>
  )
}
