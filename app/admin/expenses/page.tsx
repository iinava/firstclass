import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { listExpenseCategories, listExpenses } from "@/lib/services/accounts.service"
import { ExpenseListParamsSchema } from "@/validations/accounts.validation"
import { ExpensesView } from "./_components/expenses-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Expenses" }

export default function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Expenses"
        description="Trip costs on the road and office overheads, by category."
      />
      <Suspense fallback={<TableSkeleton withTiles />}>
        <ExpensesLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ExpensesLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("expense:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(ExpenseListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    categoryId: str("categoryId"),
    from: str("from"),
    to: str("to"),
  })

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.accounts.expenses(params),
      queryFn: () => listExpenses(params),
    }),
    queryClient.prefetchQuery({
      queryKey: ["expense-categories"],
      queryFn: () => listExpenseCategories(),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <ExpensesView />
    </Hydrate>
  )
}
