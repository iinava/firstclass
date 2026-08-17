import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { hasPermission } from "@/lib/rbac"
import { listUsers } from "@/lib/services/user.service"
import { UserListParamsSchema } from "@/validations/user.validation"
import { UsersView } from "./_components/users-view"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Users" }

export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Users"
        description="Login accounts and what each role can do."
      />
      <Suspense fallback={<TableSkeleton />}>
        <UsersLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function UsersLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission("user:view")
  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(UserListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    role: str("role"),
    isActive: str("isActive"),
  })

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: qk.users.list(params),
    queryFn: () => listUsers(params),
  })

  return (
    <Hydrate client={queryClient}>
      <UsersView
        canManage={hasPermission(session.role, "user:manage")}
        currentUserId={session.userId}
      />
    </Hydrate>
  )
}
