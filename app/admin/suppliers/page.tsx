import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listSuppliers } from "@/lib/services/supplier.service"
import { SupplierListParamsSchema } from "@/validations/supplier.validation"
import { SuppliersView } from "./_components/suppliers-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Suppliers" }

export default function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Suppliers"
        description="Hotels, transporters, guides and vendors you buy from."
      />
      <Suspense fallback={<TableSkeleton />}>
        <SuppliersLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SuppliersLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("supplier:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(SupplierListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortBy: str("sortBy") ?? "createdAt",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    type: str("type"),
    isActive: str("isActive"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.suppliers.list(params),
    queryFn: () => listSuppliers(params),
  })

  return (
    <Hydrate client={queryClient}>
      <SuppliersView />
    </Hydrate>
  )
}
