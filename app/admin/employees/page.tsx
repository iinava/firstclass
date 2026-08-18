import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listEmployees } from "@/lib/services/hrms.service"
import { EmployeeListParamsSchema } from "@/validations/hrms.validation"
import { EmployeesView } from "./_components/employees-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Employees" }

export default function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader title="Employees" description="Your team, roles and salary details." />
      <Suspense fallback={<TableSkeleton />}>
        <EmployeesLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function EmployeesLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("hrms:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(EmployeeListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    status: str("status"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.hrms.employees(params),
    queryFn: () => listEmployees(params),
  })

  return (
    <Hydrate client={queryClient}>
      <EmployeesView />
    </Hydrate>
  )
}
