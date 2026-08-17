"use client"

import * as React from "react"

import { TrendLineChart } from "@/components/shared/charts"

export interface TrendPoint {
  month: string
  revenue: number
  cost: number
  profit: number
}

/**
 * Month-by-month money on the dashboard.
 *
 * A client component only because the chart needs to measure its container;
 * the data is fetched on the server and handed down, so the page still renders
 * in one pass and the permission check stays server-side.
 */
export function RevenueTrendCard({ data }: { data: TrendPoint[] }) {
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
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-4">
        <h2 className="text-sm font-medium">Revenue, cost and profit</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Trips by the month they depart.
        </p>
      </header>
      <TrendLineChart
        data={points}
        series={[
          { key: "revenue", label: "Revenue", slot: 0 },
          { key: "cost", label: "Cost", slot: 1 },
          { key: "profit", label: "Profit", slot: 2 },
        ]}
        height={240}
        emptyMessage="Two months of trips are needed before a trend means anything."
      />
    </section>
  )
}
