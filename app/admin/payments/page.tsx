import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { getOutstanding, listReceipts } from "@/lib/services/accounts.service"
import { ReceiptListParamsSchema } from "@/validations/accounts.validation"
import { PaymentsView } from "./_components/payments-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Payments" }

export default function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Payments"
        description="Money received from customers, and what's still outstanding."
      />
      <Suspense fallback={<TableSkeleton />}>
        <PaymentsLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PaymentsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("payment:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(ReceiptListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    mode: str("mode"),
  })

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.accounts.receipts(params),
      queryFn: () => listReceipts(params),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.accounts.outstanding(),
      queryFn: async () => {
        const rows = await getOutstanding()
        return rows.map((r) => ({
          ...r,
          grandTotal: Number(r.grandTotal),
          received: Number(r.received),
          balance: Number(r.grandTotal) - Number(r.received),
        }))
      },
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <PaymentsView />
    </Hydrate>
  )
}
