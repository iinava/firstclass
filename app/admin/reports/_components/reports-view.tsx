"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  DownloadIcon,
  IndianRupeeIcon,
  PlaneTakeoffIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { MoneyBarChart, ShareDonut, TrendLineChart } from "@/components/shared/charts"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useListParams } from "@/hooks/use-list-params"
import { formatDate, formatNumber, humanize } from "@/lib/format"
import { formatMoney, formatMoneyCompact, formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  fetchExpenseByCategory,
  fetchMonthlyTrend,
  fetchProfitLoss,
  fetchRevenueByTrip,
  fetchStaffPerformance,
  fetchSupplierSpend,
  fetchVehicleExpense,
} from "../actions"

interface TripRow {
  id: string
  code: string
  title: string
  startDate: string
  status: string
  customerName: string
  revenue: number
  cost: number
  received: number
  profit: number
  margin: number
}

interface SupplierRow {
  supplierId: string
  name: string
  type: string
  spend: number
  paid: number
  outstanding: number
  lines: number
}

interface VehicleRow {
  vehicleId: string
  regNumber: string
  type: string
  ownership: string
  tripCost: number
  trips: number
  costPerTrip: number
}

interface StaffRow {
  userId: string
  name: string
  total: number
  won: number
  lost: number
  revenue: number
  trips: number
  conversionRate: number
}

/** Converts any report table to CSV and hands it to the browser. */
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ReportsView() {
  const { params, setFilter } = useListParams<{ from: string; to: string }>([
    "from",
    "to",
  ])

  const reportParams = React.useMemo(
    () => ({
      from: params.from || undefined,
      to: params.to || undefined,
      groupBy: "trip" as const,
    }),
    [params.from, params.to]
  )

  const { data: pl } = useQuery({
    queryKey: qk.reports.profitLoss(reportParams),
    queryFn: async () => unwrapAction(await fetchProfitLoss(reportParams)),
  })

  const { data: trips, isLoading: tripsLoading } = useQuery({
    queryKey: qk.reports.dashboard({ ...reportParams, view: "trip" }),
    queryFn: async () => unwrapAction(await fetchRevenueByTrip(reportParams)),
  })

  const { data: byCategory, isLoading: categoryLoading } = useQuery({
    queryKey: qk.reports.byCategory(reportParams),
    queryFn: async () => unwrapAction(await fetchExpenseByCategory(reportParams)),
  })

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: qk.reports.dashboard({ ...reportParams, view: "supplier" }),
    queryFn: async () => unwrapAction(await fetchSupplierSpend(reportParams)),
  })

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: qk.reports.dashboard({ ...reportParams, view: "vehicle" }),
    queryFn: async () => unwrapAction(await fetchVehicleExpense(reportParams)),
  })

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: qk.reports.dashboard({ ...reportParams, view: "staff" }),
    queryFn: async () => unwrapAction(await fetchStaffPerformance(reportParams)),
  })

  const { data: trend } = useQuery({
    queryKey: qk.reports.dashboard({ ...reportParams, view: "trend" }),
    queryFn: async () => unwrapAction(await fetchMonthlyTrend(reportParams)),
  })

  /** Month keys ("2026-08") are for sorting; the axis wants "Aug 26". */
  const trendData = React.useMemo(
    () =>
      (trend ?? []).map((row) => {
        const [year, month] = row.month.split("-")
        const name = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-IN", {
          month: "short",
        })
        return {
          label: `${name} ${year.slice(2)}`,
          revenue: row.revenue,
          cost: row.cost,
          profit: row.profit,
        }
      }),
    [trend]
  )

  // Charts show the leading rows; the table underneath carries the full list.
  const topTrips = React.useMemo(
    () =>
      ((trips ?? []) as TripRow[])
        .slice(0, 10)
        .map((row) => ({ label: row.code, value: row.revenue })),
    [trips]
  )

  const topSuppliers = React.useMemo(
    () =>
      ((suppliers ?? []) as SupplierRow[])
        .slice(0, 10)
        .map((row) => ({ label: row.name, value: row.spend })),
    [suppliers]
  )

  const topVehicles = React.useMemo(
    () =>
      ((vehicles ?? []) as VehicleRow[])
        .slice(0, 10)
        .map((row) => ({ label: row.regNumber, value: row.tripCost })),
    [vehicles]
  )

  const categoryShare = React.useMemo(
    () =>
      (byCategory ?? []).map((row) => ({
        label: humanize(row.category),
        value: row.amount,
      })),
    [byCategory]
  )

  const tripColumns = React.useMemo<DataTableColumn<TripRow>[]>(
    () => [
      {
        key: "trip",
        header: "Trip",
        cell: (row) => (
          <div className="min-w-0">
            <Link
              href={`/admin/trips/${row.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.title}
            </Link>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.code} · {row.customerName}
            </p>
          </div>
        ),
      },
      {
        key: "startDate",
        header: "Date",
        hideOnMobile: true,
        cell: (row) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.startDate)}
          </span>
        ),
      },
      {
        key: "revenue",
        header: "Revenue",
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.revenue)}</span>
        ),
      },
      {
        key: "cost",
        align: "right",
        header: "Cost",
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoneyShort(row.cost)}
          </span>
        ),
      },
      {
        key: "profit",
        align: "right",
        header: "Profit",
        cell: (row) => (
          <div className="tabular-nums">
            <p className={row.profit >= 0 ? "text-emerald-500" : "text-red-500"}>
              {formatMoneyShort(row.profit)}
            </p>
            <p className="text-[13px] text-muted-foreground">{row.margin.toFixed(1)}%</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        hideOnMobile: true,
        cell: (row) => <StatusBadge status={row.status} />,
      },
    ],
    []
  )

  const supplierColumns = React.useMemo<DataTableColumn<SupplierRow>[]>(
    () => [
      {
        key: "name",
        header: "Supplier",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {humanize(row.type)}
            </p>
          </div>
        ),
      },
      {
        key: "lines",
        header: "Cost lines",
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{row.lines}</span>,
      },
      {
        key: "spend",
        header: "Spend",
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.spend)}</span>
        ),
      },
      {
        key: "outstanding",
        header: "Still owed",
        cell: (row) => (
          <span
            className={cn(
              "tabular-nums",
              row.outstanding > 0 ? "text-amber-500" : "text-emerald-500"
            )}
          >
            {row.outstanding > 0 ? formatMoneyShort(row.outstanding) : "Settled"}
          </span>
        ),
      },
    ],
    []
  )

  const vehicleColumns = React.useMemo<DataTableColumn<VehicleRow>[]>(
    () => [
      {
        key: "regNumber",
        header: "Vehicle",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono font-medium">{row.regNumber}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {humanize(row.type)} · {humanize(row.ownership)}
            </p>
          </div>
        ),
      },
      {
        key: "trips",
        header: "Trips",
        cell: (row) => <span className="tabular-nums">{row.trips}</span>,
      },
      {
        key: "tripCost",
        header: "Total cost",
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.tripCost)}</span>
        ),
      },
      {
        key: "costPerTrip",
        header: "Per trip",
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoneyShort(row.costPerTrip)}
          </span>
        ),
      },
    ],
    []
  )

  const staffColumns = React.useMemo<DataTableColumn<StaffRow>[]>(
    () => [
      {
        key: "name",
        header: "Staff",
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: "total",
        align: "right",
        header: "Enquiries",
        cell: (row) => <span className="tabular-nums">{row.total}</span>,
      },
      {
        key: "won",
        header: "Won",
        cell: (row) => (
          <div className="tabular-nums">
            <p className="text-emerald-500">{row.won}</p>
            <p className="text-[13px] text-muted-foreground">
              {row.conversionRate}% conversion
            </p>
          </div>
        ),
      },
      {
        key: "revenue",
        header: "Revenue booked",
        cell: (row) => (
          <div className="tabular-nums">
            <p>{formatMoneyShort(row.revenue)}</p>
            <p className="text-[13px] text-muted-foreground">{row.trips} trips</p>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Date window */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
        <DateRangeFilter
          from={params.from}
          to={params.to}
          onChange={(range) => {
            setFilter("from", range.from ?? null)
            setFilter("to", range.to ?? null)
          }}
        />
        <p className="ml-auto text-xs text-muted-foreground">
          {pl ? `${formatDate(pl.from)} – ${formatDate(pl.to)}` : "Financial year to date"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatMoneyCompact(pl?.revenue ?? 0)}
          sub={`${formatNumber(pl?.trips ?? 0)} trips · ${formatNumber(pl?.pax ?? 0)} pax`}
          icon={IndianRupeeIcon}
        />
        <StatCard
          label="Cost"
          value={formatMoneyCompact(pl?.cost ?? 0)}
          sub={`${formatMoneyCompact(pl?.supplierCost ?? 0)} suppliers`}
          icon={WalletIcon}
        />
        <StatCard
          label="Profit"
          value={formatMoneyCompact(pl?.profit ?? 0)}
          sub={`${(pl?.margin ?? 0).toFixed(1)}% margin`}
          icon={TrendingUpIcon}
          tone={(pl?.profit ?? 0) >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Avg trip value"
          value={formatMoneyCompact(pl?.averageTripValue ?? 0)}
          sub={`${formatMoneyCompact(pl?.collected ?? 0)} collected`}
          icon={PlaneTakeoffIcon}
        />
      </div>

      {/* Revenue, cost and profit share one axis — a second scale would invent
          a relationship the numbers do not have. */}
      <section className="rounded-xl border bg-card p-5">
        <header className="mb-4">
          <h2 className="text-sm font-medium">Month by month</h2>
          <p className="text-[13px] text-muted-foreground">
            Revenue against what the trips cost to run.
          </p>
        </header>
        <TrendLineChart
          data={trendData}
          series={[
            { key: "revenue", label: "Revenue", slot: 0 },
            { key: "cost", label: "Cost", slot: 1 },
            { key: "profit", label: "Profit", slot: 2 },
          ]}
          emptyMessage="At least two months of trips are needed to draw a trend."
        />
      </section>

      <Tabs defaultValue="trips" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="trips">By trip</TabsTrigger>
          <TabsTrigger value="categories">By category</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!trips?.length}
              onClick={() => downloadCsv("revenue-by-trip.csv", trips ?? [])}
            >
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          </div>
          {topTrips.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">Highest earning trips</h2>
              <MoneyBarChart data={topTrips} />
            </section>
          )}

          <DataTable
            columns={tripColumns}
            rows={trips as TripRow[] | undefined}
            getRowId={(row) => row.id}
            isLoading={tripsLoading}
            emptyTitle="No trips in this window"
            emptyDescription="Adjust the date range, or create a trip to see it here."
          />
        </TabsContent>

        <TabsContent value="categories" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!byCategory?.length}
              onClick={() => downloadCsv("expense-by-category.csv", byCategory ?? [])}
            >
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          </div>

          {categoryLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          ) : !byCategory?.length ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              No costs recorded in this window.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <section className="rounded-xl border bg-card p-5">
                <h2 className="mb-4 text-sm font-medium">Where the money goes</h2>
                <ShareDonut data={categoryShare} />
              </section>

              <div className="rounded-xl border bg-card p-5">
              <ul className="flex flex-col gap-4">
                {byCategory.map((row) => (
                  <li key={row.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{humanize(row.category)}</span>
                      <span className="tabular-nums">
                        {formatMoney(row.amount)}{" "}
                        <span className="text-muted-foreground">
                          ({row.share.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    {/* Simple proportional bar — reads at a glance without a chart lib. */}
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(1, row.share)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="flex flex-col gap-3">
          {topSuppliers.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">Biggest suppliers by spend</h2>
              <MoneyBarChart data={topSuppliers} />
            </section>
          )}

          <DataTable
            columns={supplierColumns}
            rows={suppliers as SupplierRow[] | undefined}
            getRowId={(row) => row.supplierId}
            isLoading={suppliersLoading}
            emptyTitle="No supplier spend yet"
            emptyDescription="Record supplier costs on a trip to see who you depend on."
          />
        </TabsContent>

        <TabsContent value="vehicles" className="flex flex-col gap-3">
          {topVehicles.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">Running cost by vehicle</h2>
              <MoneyBarChart data={topVehicles} />
            </section>
          )}

          <DataTable
            columns={vehicleColumns}
            rows={vehicles as VehicleRow[] | undefined}
            getRowId={(row) => row.vehicleId}
            isLoading={vehiclesLoading}
            emptyTitle="No vehicle costs yet"
            emptyDescription="Log transport costs against a vehicle to see per-trip running cost."
          />
        </TabsContent>

        <TabsContent value="staff">
          <DataTable
            columns={staffColumns}
            rows={staff as StaffRow[] | undefined}
            getRowId={(row) => row.userId}
            isLoading={staffLoading}
            emptyTitle="No staff activity yet"
            emptyDescription="Assign enquiries to staff to track conversion and revenue."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
