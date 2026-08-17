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
import { RevenueTrendCard } from "./_components/revenue-trend-card"
import { getSession } from "@/lib/session"

export default async function AdminDashboard() {
  const session = await getSession()

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PageHeader
        title={`Welcome back${session?.username ? `, ${session.username}` : ""}`}
        description="Where the business stands today."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  const session = await requirePermission("dashboard:view")
  const scope = canViewAll(session.role, "booking") ? null : session.userId
  const summary = await getDashboardSummary(scope)

  // The trend is money, so it follows the financial-report permission rather
  // than dashboard:view — sales and operations see the rest of the page.
  const showTrend = hasPermission(session.role, "report:financial")
  const trend = showTrend ? await getMonthlyTrend({ groupBy: "month" } as never) : []

  const { leads, bookings, money, followups, upcomingTrips, recentLeads } = summary

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open enquiries"
          value={formatNumber(leads.open)}
          sub={`${leads.newThisMonth} new this month`}
          icon={BriefcaseIcon}
        />
        <StatCard
          label="Follow-ups due"
          value={formatNumber(followups.today + followups.overdue)}
          sub={
            followups.overdue > 0
              ? `${followups.overdue} overdue`
              : "Nothing overdue"
          }
          icon={followups.overdue > 0 ? AlertCircleIcon : CalendarCheckIcon}
          tone={followups.overdue > 0 ? "negative" : "default"}
        />
        <StatCard
          label="Active trips"
          value={formatNumber(bookings.active)}
          sub={
            bookings.travellingNow > 0
              ? `${bookings.travellingNow} travelling now`
              : `${bookings.thisMonth} booked this month`
          }
          icon={PlaneTakeoffIcon}
        />
        <StatCard
          label="Booked this month"
          value={formatMoneyCompact(money.bookedValue)}
          sub={`${formatMoneyCompact(money.activeValue)} on active trips`}
          icon={IndianRupeeIcon}
          tone="positive"
        />
      </div>

      {showTrend && <RevenueTrendCard data={trend} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-medium">Upcoming departures</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Trips starting soon
              </p>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/admin/bookings" />}>
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
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{trip.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {trip.customerName} · {formatDate(trip.startDate)}
                    </p>
                  </div>
                  <StatusBadge status={trip.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-medium">Latest enquiries</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Most recent leads in the pipeline
              </p>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/admin/leads" />}>
              View all
            </Button>
          </header>

          {recentLeads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No enquiries yet — log the next call from the Leads page.
            </p>
          ) : (
            <ul className="divide-y">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead.customerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
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
    <div className="flex flex-col gap-6">
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
