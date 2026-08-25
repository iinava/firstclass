"use client"

import * as React from "react"
import { parseAsString, useQueryStates } from "nuqs"

import { TrendBarChart } from "@/components/shared/charts"
import { DateRangeFilter } from "@/components/shared/date-range-filter"

export interface TrendPoint {
  month: string
  revenue: number
  cost: number
  profit: number
}

/**
 * Month-by-month money on the dashboard, with the same from/to date window
 * as the Reports page.
 *
 * A client component both because the chart needs to measure its container
 * and because the date filter writes to the URL; the data itself is fetched
 * on the server from those URL params, so the page still renders in one pass
 * and the permission check stays server-side. `shallow: false` forces a
 * server round-trip on every change — there's no client-side query cache
 * here to hydrate from, unlike the Reports page.
 */
export function RevenueTrendCard({
  data,
  from,
  to,
}: {
  data: TrendPoint[]
  from?: string
  to?: string
}) {
  const [, setParams] = useQueryStates(
    { from: parseAsString, to: parseAsString },
    { history: "replace", shallow: false }
  )

  const points = React.useMemo(
    () =>
      data.map((row) => {
        const [year, month] = row.month.split("-")
        const name = new Date(Number(year), Number(month) - 1, 1).toLocaleString(
          "en-IN",
          { month: "short" }
        )
        return {
          label: `${name} ${year.slice(2)}`,
          revenue: row.revenue,
          cost: row.cost,
          profit: row.profit,
        }
      }),
    [data]
  )

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      {/* Same ruled, uppercase header as every other panel on the page. */}
      <header className="flex h-12 flex-wrap items-center justify-between gap-2 border-b px-5">
        <h2 className="text-sm font-medium">
          Revenue, cost and profit
        </h2>
        <DateRangeFilter
          from={from}
          to={to}
          onChange={(range) =>
            setParams({ from: range.from ?? null, to: range.to ?? null })
          }
          className="h-7 text-xs"
        />
      </header>
      <div className="p-4">
        <TrendBarChart
          data={points}
          series={[
            { key: "revenue", label: "Revenue", slot: 0 },
            { key: "cost", label: "Cost", slot: 1 },
            { key: "profit", label: "Profit", slot: 2 },
          ]}
          height={200}
          emptyMessage="Two months of trips are needed before a trend means anything."
        />
      </div>
    </section>
  )
}
