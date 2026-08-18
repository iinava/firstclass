import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listCustomers } from "@/lib/services/customer.service"
import { CustomerListParamsSchema } from "@/validations/customer.validation"
import { CustomersView } from "./_components/customers-view"
import { CustomersViewSkeleton } from "./_components/customers-view-skeleton"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Customers" }

/**
 * The header renders immediately from the static shell; only the data-dependent
 * table sits behind Suspense. Clicking "Customers" in the sidebar therefore
 * paints the page instantly and streams the rows in.
 */
export default function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Customers"
        description="Everyone who has ever enquired or travelled with you."
      />
      <Suspense fallback={<CustomersViewSkeleton />}>
        <CustomersLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CustomersLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("customer:view")

  const raw = await searchParams
  // Unknown/garbage query strings fall back to defaults rather than 500ing.
  const params = safeListParams(CustomerListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: typeof raw.search === "string" ? raw.search : undefined,
    sortBy: typeof raw.sortBy === "string" ? raw.sortBy : "createdAt",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    source: typeof raw.source === "string" ? raw.source : undefined,
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.customers.list(params),
    queryFn: () => listCustomers(params),
  })

  return (
    <Hydrate client={queryClient}>
      <CustomersView />
    </Hydrate>
  )
}
