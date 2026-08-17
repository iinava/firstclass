import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listInvoices } from "@/lib/services/accounts.service"
import { InvoiceListParamsSchema } from "@/validations/accounts.validation"
import { InvoicesView } from "./_components/invoices-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Invoices" }

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Invoices"
        description="Customer invoices raised against confirmed trips."
      />
      <Suspense fallback={<TableSkeleton />}>
        <InvoicesLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function InvoicesLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("invoice:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(InvoiceListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    status: str("status"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.accounts.invoices(params),
    queryFn: () => listInvoices(params),
  })

  return (
    <Hydrate client={queryClient}>
      <InvoicesView />
    </Hydrate>
  )
}
