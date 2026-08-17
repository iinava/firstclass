import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { canViewAll } from "@/lib/rbac"
import { getAssignableUsers, getLeadStats, listLeads } from "@/lib/services/lead.service"
import { LeadListParamsSchema } from "@/validations/lead.validation"
import { LeadsView } from "./_components/leads-view"
import { LeadsViewSkeleton } from "./_components/leads-view-skeleton"
import { safeListParams } from "@/validations/common.validation"

export const metadata: Metadata = { title: "Leads" }

export default function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title="Leads"
        description="Every enquiry, from first call to won or lost."
      />
      <Suspense fallback={<LeadsViewSkeleton />}>
        <LeadsLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function LeadsLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission("lead:view")
  const raw = await searchParams

  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined

  const params = safeListParams(LeadListParamsSchema, {
    page: raw.page ?? 1,
    pageSize: 25,
    search: str("search"),
    sortBy: str("sortBy") ?? "createdAt",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    status: str("status"),
    priority: str("priority"),
    source: str("source"),
    assignedTo: str("assignedTo"),
  })

  const scope = canViewAll(session.role, "lead") ? null : session.userId
  const queryClient = getQueryClient()

  // Prefetched in parallel so the table, tiles and assignee list all arrive in
  // the same streamed chunk rather than waterfalling.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.leads.list(params),
      queryFn: () => listLeads(params, scope),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.leads.stats(),
      queryFn: () => getLeadStats(scope),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.users.options(),
      queryFn: () => getAssignableUsers(),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <LeadsView />
    </Hydrate>
  )
}
