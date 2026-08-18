import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { Hydrate } from "@/components/shared/hydrate"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import { getAttendanceForDate, listLeaves } from "@/lib/services/hrms.service"
import { AttendanceView } from "./_components/attendance-view"

export const metadata: Metadata = { title: "Attendance" }

export default function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Attendance"
        description="Mark the day's register and review leave requests."
      />
      <Suspense fallback={<TableSkeleton />}>
        <AttendanceLoader searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AttendanceLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission("hrms:view")
  const raw = await searchParams
  const date =
    typeof raw.date === "string" && raw.date
      ? raw.date
      : new Date().toISOString().slice(0, 10)

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.hrms.attendance({ date }),
      queryFn: () => getAttendanceForDate(date),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.hrms.leaves({ status: "pending" }),
      queryFn: () =>
        listLeaves({ page: 1, pageSize: 25, sortDir: "desc", status: "pending" } as never),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <AttendanceView />
    </Hydrate>
  )
}
