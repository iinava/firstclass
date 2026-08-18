"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BusIcon,
  CalendarIcon,
  IndianRupeeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  Trash2Icon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Meter, MoneyBarChart } from "@/components/shared/charts"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { formatDate, formatPax, formatPhone, humanize } from "@/lib/format"
import { formatMoney, formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  COST_CATEGORY_LABELS,
} from "@/validations/booking.validation"
import type { TripCostRow } from "@/lib/services/booking.service"
import { removeAssignment, fetchAssignments } from "@/app/admin/fleet/actions"
import {
  deleteTripCost,
  fetchBooking,
  fetchBookingLedger,
  fetchTripCosts,
  updateBookingStatus,
} from "../../actions"
import { AssignVehicleDialog } from "./assign-vehicle-dialog"
import { TripFormDialog } from "../../_components/trip-form-dialog"
import { ReceiptDialog } from "./receipt-dialog"
import { TripCostDialog } from "./trip-cost-dialog"

export function TripDetail({ tripId }: { tripId: string }) {
  const { data: trip } = useQuery({
    queryKey: qk.bookings.detail(tripId),
    queryFn: async () => unwrapAction(await fetchBooking({ id: tripId })),
  })

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: qk.bookings.costs(tripId),
    queryFn: async () => unwrapAction(await fetchTripCosts({ bookingId: tripId })),
  })

  const { data: ledger } = useQuery({
    queryKey: qk.bookings.ledger(tripId),
    queryFn: async () => unwrapAction(await fetchBookingLedger({ id: tripId })),
  })

  const { data: assignments } = useQuery({
    queryKey: qk.vehicles.availability({ bookingId: tripId }),
    queryFn: async () => unwrapAction(await fetchAssignments({ bookingId: tripId })),
  })

  const [costOpen, setCostOpen] = React.useState(false)
  const [editingCost, setEditingCost] = React.useState<TripCostRow | null>(null)
  const [deletingCost, setDeletingCost] = React.useState<TripCostRow | null>(null)
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [tab, setTab] = React.useState("costs")

  const statusMutation = useActionMutation({
    action: updateBookingStatus,
    successMessage: "Status updated",
    invalidate: [qk.bookings.all],
  })

  const removeCost = useActionMutation({
    action: deleteTripCost,
    successMessage: "Cost line removed",
    invalidate: [qk.bookings.all, qk.reports.all],
    onSuccess: () => setDeletingCost(null),
  })

  const removeVehicle = useActionMutation({
    action: removeAssignment,
    successMessage: "Vehicle unassigned",
    invalidate: [qk.vehicles.all, qk.bookings.all],
  })

  const costColumns = React.useMemo<DataTableColumn<TripCostRow>[]>(
    () => [
      {
        key: "description",
        header: "Item",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.description}</p>
            {/* Quantity goes on the detail line — appended to the description it
                collided with text that already said "2 nights". */}
            <p className="truncate text-[13px] text-muted-foreground">
              {COST_CATEGORY_LABELS[row.category]}
              {row.quantity > 1 ? ` · ${row.quantity} units` : ""}
              {row.supplierName ? ` · ${row.supplierName}` : ""}
              {row.vehicleReg ? ` · ${row.vehicleReg}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "serviceDate",
        header: "Date",
        hideOnMobile: true,
        cell: (row) => (
          <span className="whitespace-nowrap text-[15px] text-muted-foreground">
            {formatDate(row.serviceDate)}
          </span>
        ),
      },
      {
        // Cost / Qty / Paid were three columns describing one supplier bill.
        key: "cost",
        header: "Cost",
        cell: (row) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[15px] tabular-nums">
              {formatMoneyShort(row.costAmount)}
            </p>
            <p className="whitespace-nowrap text-[13px] text-muted-foreground">
              {row.paymentStatus === "paid"
                ? "Paid"
                : row.paidAmount > 0
                  ? `${formatMoneyShort(row.paidAmount)} paid`
                  : "Not paid"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-20",
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit cost"
              onClick={() => {
                setEditingCost(row)
                setCostOpen(true)
              }}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete cost"
              onClick={() => setDeletingCost(row)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  if (!trip) return null

  const isClosed = trip.status === "cancelled" || trip.status === "completed"

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 w-fit px-2 text-xs text-muted-foreground"
          render={<Link href="/admin/trips" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          All trips
        </Button>

        <PageHeader
          title={trip.title}
          description={`${trip.code} · ${trip.customerName} · ${formatPhone(trip.customerPhone)}`}
          actions={
            /* The two things staff actually do on this page are collecting
               money and handing over an invoice, so both are one click. */
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={trip.status} />

              <Button
                size="sm"
                disabled={trip.balance <= 0}
                onClick={() => setReceiptOpen(true)}
              >
                <IndianRupeeIcon data-icon="inline-start" />
                Record payment
              </Button>

              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/admin/trips/${tripId}/invoice`} />}
              >
                <PrinterIcon data-icon="inline-start" />
                Print invoice
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon-sm" />}
                  aria-label="More actions"
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <PencilIcon className="size-4" />
                    Edit trip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssignOpen(true)}>
                    <BusIcon className="size-4" />
                    Assign vehicle
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {/* The label is a group part — outside DropdownMenuGroup Base
                      UI throws and the page falls into the error boundary. */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Move to status
                    </DropdownMenuLabel>
                    {BOOKING_STATUSES.filter(
                      (status) => status !== "cancelled" && status !== trip.status
                    ).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        disabled={statusMutation.isPending || isClosed}
                        onClick={() =>
                          statusMutation.mutate({ id: tripId, status } as never)
                        }
                      >
                        {BOOKING_STATUS_LABELS[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      </div>

      {/* One card, not a loose meter plus four floating tiles. These four
          numbers are a single reading of the trip's money, and the collection
          bar is the same fact as "received vs value" — so it sits with them. */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <dl className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>div]:p-5">
          <Figure
            label="Trip value"
            icon={IndianRupeeIcon}
            value={formatMoneyShort(trip.grandTotal)}
            sub={formatPax(trip.adults, trip.children, trip.infants)}
          />
          <Figure
            label="Received"
            icon={ReceiptIcon}
            value={formatMoneyShort(ledger?.received ?? 0)}
            sub={
              ledger?.advance
                ? `${formatMoneyShort(ledger.advance)} advance`
                : "No advance recorded"
            }
            tone="positive"
          />
          <Figure
            label="Balance due"
            icon={CalendarIcon}
            value={formatMoneyShort(ledger?.balance ?? 0)}
            sub={
              (ledger?.balance ?? 0) > 0
                ? `Collect by ${formatDate(trip.endDate)}`
                : "Fully settled"
            }
            tone={(ledger?.balance ?? 0) > 0 ? "warning" : "positive"}
          />
          <Figure
            label="Profit"
            icon={TrendingUpIcon}
            value={formatMoneyShort(ledger?.profit ?? 0)}
            sub={`${(ledger?.margin ?? 0).toFixed(1)}% margin · ${formatMoneyShort(ledger?.cost ?? 0)} cost`}
            tone={(ledger?.profit ?? 0) >= 0 ? "positive" : "negative"}
          />
        </dl>

        <div className="border-t bg-muted/30 px-4 py-3">
          <Meter
            value={ledger?.received ?? 0}
            total={trip.grandTotal}
            label="Collected against trip value"
          />
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex flex-col gap-4"
      >
        {/* The tab's action lives on the tab bar rather than in a row of its
            own above the table, so the content starts right below the tabs. */}
        <div className="flex items-end justify-between gap-4 border-b pb-1.5">
          {/* "line" is the primitive's underline variant — pill tabs sitting
              inside a ruled bar were two idioms fighting each other. */}
          <TabsList variant="line" className="gap-3">
            <TabsTrigger value="costs">
              Costs{costs?.length ? ` (${costs.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              Vehicles{assignments?.length ? ` (${assignments.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="summary">Breakdown</TabsTrigger>
          </TabsList>

          {tab === "costs" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingCost(null)
                setCostOpen(true)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              Add cost
            </Button>
          )}
          {tab === "vehicles" && (
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Assign vehicle
            </Button>
          )}
        </div>

        <TabsContent value="costs">
          <DataTable
            columns={costColumns}
            rows={costs}
            getRowId={(row) => row.id}
            isLoading={costsLoading}
            skeletonRows={5}
            emptyTitle="No costs recorded"
            emptyDescription="Add hotels, transport and services so this trip's profit is real."
          />
        </TabsContent>

        <TabsContent value="vehicles">
          {!assignments?.length ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              No vehicle assigned yet.
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex h-14 items-center justify-between gap-3 px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium font-mono">
                      {assignment.regNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(assignment.startDate)} – {formatDate(assignment.endDate)}
                      {assignment.driverName
                        ? ` · ${assignment.driverName} (${formatPhone(assignment.driverPhone)})`
                        : " · no driver"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Unassign vehicle"
                    disabled={removeVehicle.isPending}
                    onClick={() => removeVehicle.mutate({ id: assignment.id })}
                  >
                    <XCircleIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border bg-card">
              <header className="flex h-12 items-center border-b px-5">
                <h2 className="text-sm font-medium">
                  Cost by category
                </h2>
              </header>
              {!ledger?.costByCategory.length ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No costs recorded yet.
                </p>
              ) : (
                <>
                  <div className="px-5 pt-4">
                    <MoneyBarChart
                      data={ledger.costByCategory
                        .slice()
                        .sort((a, b) => b.cost - a.cost)
                        .map((row) => ({
                          label: humanize(row.category),
                          value: row.cost,
                        }))}
                    />
                  </div>
                  <ul className="divide-y">
                  {ledger.costByCategory
                    .slice()
                    .sort((a, b) => b.cost - a.cost)
                    .map((row) => (
                      <li
                        key={row.category}
                        className="flex items-center justify-between px-5 py-3 text-sm"
                      >
                        <span>{humanize(row.category)}</span>
                        <span className="tabular-nums">{formatMoney(row.cost)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <header className="flex h-12 items-center border-b px-5">
                <h2 className="text-sm font-medium">
                  Money
                </h2>
              </header>
              <dl className="divide-y text-sm">
                {[
                  ["Trip value", ledger?.revenue ?? 0, ""],
                  ["Supplier costs", -(ledger?.supplierCost ?? 0), "text-red-500"],
                  ["Direct expenses", -(ledger?.directExpense ?? 0), "text-red-500"],
                  [
                    "Profit",
                    ledger?.profit ?? 0,
                    (ledger?.profit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500",
                  ],
                  ["Received", ledger?.received ?? 0, "text-emerald-500"],
                  ["Balance due", ledger?.balance ?? 0, "text-amber-500"],
                  ["Owed to suppliers", ledger?.supplierOutstanding ?? 0, "text-amber-500"],
                ].map(([label, value, tone]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <dt className="text-muted-foreground">{label as string}</dt>
                    <dd className={cn("tabular-nums font-medium", tone as string)}>
                      {formatMoney(value as number)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <TripCostDialog
        open={costOpen}
        onOpenChange={(open) => {
          setCostOpen(open)
          if (!open) setEditingCost(null)
        }}
        bookingId={tripId}
        cost={editingCost}
      />

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        bookingId={tripId}
        balance={ledger?.balance ?? 0}
        isFirstPayment={(ledger?.received ?? 0) === 0}
      />

      <AssignVehicleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        bookingId={tripId}
        startDate={trip.startDate}
        endDate={trip.endDate}
      />

      <TripFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={trip}
      />

      <ConfirmDialog
        open={Boolean(deletingCost)}
        onOpenChange={(open) => !open && setDeletingCost(null)}
        title="Remove this cost line?"
        description="Lines with supplier payments against them can't be removed."
        confirmLabel="Remove"
        variant="destructive"
        isPending={removeCost.isPending}
        onConfirm={() => deletingCost && removeCost.mutate({ id: deletingCost.id })}
      />
    </div>
  )
}

const FIGURE_TONE = {
  default: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
} as const

/** One cell of the money strip. Same three-rank hierarchy as StatCard. */
function Figure({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: keyof typeof FIGURE_TONE
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
          FIGURE_TONE[tone]
        )}
      >
        {value}
      </dd>
      <dd className="mt-2 truncate text-[13px] text-muted-foreground">{sub}</dd>
    </div>
  )
}
