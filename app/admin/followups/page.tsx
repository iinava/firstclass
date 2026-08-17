import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { canViewAll } from "@/lib/rbac"
import { getFollowupCounts, listFollowups } from "@/lib/services/followup.service"
import { FollowupQueueParamsSchema } from "@/validations/lead.validation"
import { FollowupsView } from "./_components/followups-view"
import { FollowupsViewSkeleton } from "./_components/followups-view-skeleton"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Follow-ups" }

export default function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Follow-ups"
        description="Everything you owe a customer today, and what's coming up."
      />
      <Suspense fallback={<FollowupsViewSkeleton />}>
        <FollowupsLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function FollowupsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission("lead:view")
  const raw = await searchParams

  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(FollowupQueueParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    bucket: str("bucket") ?? "today",
    search: str("search"),
    assignedTo: str("assignedTo"),
    status: str("status"),
  })

  const scope = canViewAll(session.role, "lead") ? null : session.userId
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.followups.queue(params),
      queryFn: () => listFollowups(params, scope),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.followups.counts(),
      queryFn: () => getFollowupCounts(scope),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <FollowupsView />
    </Hydrate>
  )
}
