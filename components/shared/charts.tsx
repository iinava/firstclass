"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatMoneyCompact, formatMoneyShort } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The chart shapes this app actually needs, each pinned to one job.
 *
 * Form is chosen by what the reader has to do, not by variety: magnitude is a
 * bar, change over time is a line, part-to-whole is a donut and only when there
 * are few enough slices to read at a glance. Colour follows from that — a
 * single-series bar is one hue for every bar, because colouring bars by their
 * own value would encode length twice and spend the only free channel on
 * information the bar already carries.
 *
 * Series colours come from `--chart-1…8` in globals.css, assigned in fixed
 * order and never cycled. That order is what keeps adjacent colours apart for
 * colour-blind readers, so slots are taken from the top, not picked to taste.
 */

/** Slot order is the accessibility mechanism — take from the top, never shuffle. */
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const

/** Past six slices a donut stops being readable, so the tail folds into one. */
const MAX_SLICES = 6

const axisTick = {
  fill: "var(--color-muted-foreground)",
  fontSize: 11,
} as const

function EmptyPlot({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ money bar */

export interface BarDatum {
  label: string
  value: number
  /** Optional second value shown only in the tooltip, e.g. amount already paid. */
  secondary?: number
}

/**
 * Horizontal bar for "which of these is biggest" — one hue for every bar.
 *
 * Horizontal because the categories are names (trips, suppliers, categories)
 * that would otherwise be rotated or truncated on an x-axis.
 */
export function MoneyBarChart({
  data,
  className,
  secondaryLabel,
  height,
  emptyMessage = "Nothing in this period yet.",
}: {
  data: BarDatum[]
  className?: string
  secondaryLabel?: string
  height?: number
  emptyMessage?: string
}) {
  const rows = data.filter((d) => d.value > 0)
  if (rows.length === 0) return <EmptyPlot message={emptyMessage} className={className} />

  const config: ChartConfig = {
    value: { label: "Amount", color: "var(--chart-1)" },
    ...(secondaryLabel ? { secondary: { label: secondaryLabel } } : {}),
  }

  return (
    <ChartContainer
      config={config}
      className={cn("w-full", className)}
      style={{ height: height ?? Math.max(160, rows.length * 34 + 24) }}
    >
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ left: 4, right: 56, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <YAxis
          dataKey="label"
          type="category"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          interval={0}
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatMoneyShort(Number(value))}
            />
          }
        />
        <Bar dataKey="value" fill="var(--chart-1)" radius={4} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  )
}

/* ---------------------------------------------------------------- trend line */

export interface TrendSeries {
  key: string
  label: string
  /** Index into SERIES — fixed per entity so a filter never repaints it. */
  slot: number
}

/**
 * Change over time. Lines rather than bars because the reader is following a
 * shape, and one axis only — a second scale would invent a correlation.
 */
export function TrendLineChart({
  data,
  series,
  xKey = "label",
  className,
  height = 260,
  emptyMessage = "Not enough history to chart yet.",
}: {
  data: Record<string, string | number>[]
  series: TrendSeries[]
  xKey?: string
  className?: string
  height?: number
  emptyMessage?: string
}) {
  if (data.length < 2) return <EmptyPlot message={emptyMessage} className={className} />

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: SERIES[s.slot] }])
  )

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
      >
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          width={56}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as string]?.label ?? name}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoneyShort(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={SERIES[s.slot]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

/* ---------------------------------------------------------------- share donut */

export interface ShareDatum {
  label: string
  value: number
}

/**
 * Part-to-whole, at a glance only. Slices past the sixth are folded into
 * "Other" rather than given new hues — a generated ninth colour is
 * indistinguishable from an existing one for a colour-blind reader.
 */
export function ShareDonut({
  data,
  className,
  height = 220,
  emptyMessage = "Nothing recorded in this period.",
}: {
  data: ShareDatum[]
  className?: string
  height?: number
  emptyMessage?: string
}) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  if (sorted.length === 0) return <EmptyPlot message={emptyMessage} className={className} />

  const slices =
    sorted.length > MAX_SLICES
      ? [
          ...sorted.slice(0, MAX_SLICES - 1),
          {
            label: "Other",
            value: sorted
              .slice(MAX_SLICES - 1)
              .reduce((sum, slice) => sum + slice.value, 0),
          },
        ]
      : sorted

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [
      slice.label,
      { label: slice.label, color: SERIES[index] },
    ])
  )

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <ChartContainer config={config} className="w-full sm:w-1/2" style={{ height }}>
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-medium tabular-nums">
                      {formatMoneyShort(Number(value))}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            // A surface-coloured gap separates segments instead of a border.
            paddingAngle={2}
            stroke="var(--color-card)"
            strokeWidth={2}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.label} fill={SERIES[index]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* The legend doubles as the table view — colour never carries the
          identity or the value on its own. */}
      <ul className="flex w-full flex-col gap-1.5 sm:w-1/2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SERIES[index] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {slice.label}
            </span>
            <span className="tabular-nums">{formatMoneyShort(slice.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------------------------------------------------------- share bar */

/**
 * Part-to-whole as a single stacked bar — better than a donut when the
 * categories are states of one thing (invoice statuses, payment modes) and the
 * reader wants the split, not the geometry.
 */
export function ShareBar({
  data,
  className,
  emptyMessage = "Nothing to show yet.",
}: {
  data: ShareDatum[]
  className?: string
  emptyMessage?: string
}) {
  const slices = data.filter((d) => d.value > 0).slice(0, SERIES.length)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return <EmptyPlot message={emptyMessage} className={className} />

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {slices.map((slice, index) => (
          <span
            key={slice.label}
            title={`${slice.label}: ${formatMoneyShort(slice.value)}`}
            style={{
              background: SERIES[index],
              width: `${(slice.value / total) * 100}%`,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SERIES[index] }}
            />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="tabular-nums">{formatMoneyShort(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------- meter */

/**
 * One ratio against a limit — money collected against what a trip is worth.
 * A meter rather than a two-slice pie, which is the classic way to make one
 * number unreadable.
 */
export function Meter({
  value,
  total,
  label,
  className,
  tone = "auto",
}: {
  value: number
  total: number
  label?: string
  className?: string
  /** "auto" turns amber while money is still outstanding, green once settled. */
  tone?: "auto" | "neutral"
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  const settled = total > 0 && value >= total
  const fill =
    tone === "neutral"
      ? "var(--chart-1)"
      : settled
        ? "var(--chart-good)"
        : "var(--chart-warning)"

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums">
            {formatMoneyShort(value)}
            <span className="text-muted-foreground"> / {formatMoneyShort(total)}</span>
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Collected"}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
    </div>
  )
}
