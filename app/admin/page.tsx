import { Suspense } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  BriefcaseIcon,
  CalendarCheckIcon,
  IndianRupeeIcon,
  PlaneTakeoffIcon,
} from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/action"
import { canViewAll, hasPermission } from "@/lib/rbac"
import { formatDate, formatNumber, formatRelativeDay } from "@/lib/format"
import { formatMoneyCompact } from "@/lib/money"
import { getDashboardSummary } from "@/lib/services/dashboard.service"
import { getMonthlyTrend } from "@/lib/services/report.service"
import { ReportParamsSchema } from "@/validations/accounts.validation"
import { safeListParams } from "@/validations/common.validation"
import { RevenueTrendCard } from "./_components/revenue-trend-card"
import { getSession } from "@/lib/session"

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title={`Welcome back${session?.username ? `, ${session.username}` : ""}`}
        description="Where the business stands today."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission("dashboard:view")
  const scope = canViewAll(session.role, "booking") ? null : session.userId
  const summary = await getDashboardSummary(scope)

  // The trend is money, so it follows the financial-report permission rather
  // than dashboard:view — sales and operations see the rest of the page.
  const showTrend = hasPermission(session.role, "report:financial")

  const raw = await searchParams
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined
  const trendParams = safeListParams(ReportParamsSchema, {
    from: str("from"),
    to: str("to"),
    groupBy: "month",
  })

  const trend = showTrend ? await getMonthlyTrend(trendParams) : []

  const { leads, bookings, money, followups, upcomingTrips, recentLeads } = summary

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Each tile answers a question someone actually asks in the morning,
            so the sub-line is a sentence rather than a second statistic. */}
        <StatCard
          label="Enquiries open"
          value={formatNumber(leads.open)}
          sub={
            leads.newThisMonth > 0
              ? `${leads.newThisMonth} came in this month`
              : "None new this month"
          }
          icon={BriefcaseIcon}
        />
        <StatCard
          label="Calls to make"
          value={formatNumber(followups.today + followups.overdue)}
          sub={
            followups.overdue > 0
              ? `${followups.overdue} already late`
              : "All on schedule"
          }
          icon={followups.overdue > 0 ? AlertCircleIcon : CalendarCheckIcon}
          tone={followups.overdue > 0 ? "negative" : "default"}
        />
        <StatCard
          label="Trips running"
          value={formatNumber(bookings.active)}
          sub={
            bookings.travellingNow > 0
              ? `${bookings.travellingNow} travelling right now`
              : `${bookings.thisMonth} booked this month`
          }
          icon={PlaneTakeoffIcon}
        />
        <StatCard
          label="Booked this month"
          value={formatMoneyCompact(money.bookedValue)}
          sub={`${formatMoneyCompact(money.activeValue)} still on the road`}
          icon={IndianRupeeIcon}
          tone="positive"
        />
      </div>

      {showTrend && (
        <RevenueTrendCard data={trend} from={trendParams.from} to={trendParams.to} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card">
          <header className="flex h-12 items-center justify-between gap-2 border-b pl-5 pr-2">
            <h2 className="text-sm font-medium">
              Upcoming departures
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              render={<Link href="/admin/trips" />}
            >
              View all
            </Button>
          </header>

          {upcomingTrips.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No upcoming departures scheduled.
            </p>
          ) : (
            <ul className="divide-y">
              {upcomingTrips.map((trip) => (
                <li
                  key={trip.id}
                  className="flex h-[4.5rem] items-center justify-between gap-3 px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{trip.title}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {trip.customerName} · {formatDate(trip.startDate)}
                    </p>
                  </div>
                  <StatusBadge status={trip.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <header className="flex h-12 items-center justify-between gap-2 border-b pl-5 pr-2">
            <h2 className="text-sm font-medium">
              Latest enquiries
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              render={<Link href="/admin/leads" />}
            >
              View all
            </Button>
          </header>

          {recentLeads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No enquiries yet — log the next call from the Enquiries page.
            </p>
          ) : (
            <ul className="divide-y">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex h-[4.5rem] items-center justify-between gap-3 px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">
                      {lead.customerName}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {lead.destination ?? "Destination TBD"} ·{" "}
                      {formatRelativeDay(lead.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
