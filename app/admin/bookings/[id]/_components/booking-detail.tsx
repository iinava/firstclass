"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BusIcon,
  CalendarIcon,
  IndianRupeeIcon,
  PencilIcon,
  PlusIcon,
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
import { StatCard } from "@/components/shared/stat-card"
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
import { createInvoice } from "@/app/admin/accounts-actions"
import {
  deleteTripCost,
  fetchBooking,
  fetchBookingLedger,
  fetchTripCosts,
  updateBookingStatus,
} from "../../actions"
import { AssignVehicleDialog } from "./assign-vehicle-dialog"
import { BookingFormDialog } from "../../_components/booking-form-dialog"
import { ReceiptDialog } from "./receipt-dialog"
import { TripCostDialog } from "./trip-cost-dialog"

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const { data: booking } = useQuery({
    queryKey: qk.bookings.detail(bookingId),
    queryFn: async () => unwrapAction(await fetchBooking({ id: bookingId })),
  })

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: qk.bookings.costs(bookingId),
    queryFn: async () => unwrapAction(await fetchTripCosts({ bookingId })),
  })

  const { data: ledger } = useQuery({
    queryKey: qk.bookings.ledger(bookingId),
    queryFn: async () => unwrapAction(await fetchBookingLedger({ id: bookingId })),
  })

  const { data: assignments } = useQuery({
    queryKey: qk.vehicles.availability({ bookingId }),
    queryFn: async () => unwrapAction(await fetchAssignments({ bookingId })),
  })

  const [costOpen, setCostOpen] = React.useState(false)
  const [editingCost, setEditingCost] = React.useState<TripCostRow | null>(null)
  const [deletingCost, setDeletingCost] = React.useState<TripCostRow | null>(null)
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

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

  const invoiceMutation = useActionMutation({
    action: createInvoice,
    successMessage: "Invoice raised",
    invalidate: [qk.accounts.all, qk.bookings.all],
  })

  const costColumns = React.useMemo<DataTableColumn<TripCostRow>[]>(
    () => [
      {
        key: "description",
        header: "Item",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {COST_CATEGORY_LABELS[row.category]}
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
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.serviceDate)}
          </span>
        ),
      },
      {
        key: "qty",
        header: "Qty",
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
      },
      {
        key: "cost",
        header: "Cost",
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.costAmount)}</span>
        ),
      },
      {
        key: "paid",
        header: "Paid",
        hideOnMobile: true,
        cell: (row) => (
          <div className="tabular-nums">
            <StatusBadge status={row.paymentStatus} />
            {row.paidAmount > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMoneyShort(row.paidAmount)}
              </p>
            )}
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

  if (!booking) return null

  const isClosed = booking.status === "cancelled" || booking.status === "completed"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2"
          render={<Link href="/admin/bookings" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          All bookings
        </Button>

        <PageHeader
          title={booking.title}
          description={`${booking.code} · ${booking.customerName} · ${formatPhone(booking.customerPhone)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={booking.status} />
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" />}>
                  Actions
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    disabled={booking.balance <= 0}
                    onClick={() => setReceiptOpen(true)}
                  >
                    <IndianRupeeIcon className="size-4" />
                    Record payment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssignOpen(true)}>
                    <BusIcon className="size-4" />
                    Assign vehicle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={invoiceMutation.isPending}
                    onClick={() =>
                      invoiceMutation.mutate({
                        bookingId,
                        issueDate: new Date().toISOString().slice(0, 10),
                        dueDate: booking.endDate,
                      } as never)
                    }
                  >
                    <ReceiptIcon className="size-4" />
                    Raise invoice
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {/* The label is a group part — outside DropdownMenuGroup Base
                      UI throws and the page falls into the error boundary. */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Move to status
                    </DropdownMenuLabel>
                    {BOOKING_STATUSES.filter(
                      (status) => status !== "cancelled" && status !== booking.status
                    ).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        disabled={statusMutation.isPending || isClosed}
                        onClick={() =>
                          statusMutation.mutate({ id: bookingId, status } as never)
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

      {/* How much of the trip has actually been collected — one ratio against a
          limit, so a meter rather than another tile. */}
      <Meter
        value={ledger?.received ?? 0}
        total={booking.grandTotal}
        label="Collected against trip value"
      />

      {/* Money position */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Trip value"
          value={formatMoneyShort(booking.grandTotal)}
          sub={formatPax(booking.adults, booking.children, booking.infants)}
          icon={IndianRupeeIcon}
        />
        <StatCard
          label="Received"
          value={formatMoneyShort(ledger?.received ?? 0)}
          sub={
            ledger?.advance
              ? `${formatMoneyShort(ledger.advance)} advance`
              : "No advance recorded"
          }
          icon={ReceiptIcon}
          tone="positive"
        />
        <StatCard
          label="Balance due"
          value={formatMoneyShort(ledger?.balance ?? 0)}
          sub={
            (ledger?.balance ?? 0) > 0
              ? `Collect by ${formatDate(booking.endDate)}`
              : "Fully settled"
          }
          icon={CalendarIcon}
          tone={(ledger?.balance ?? 0) > 0 ? "warning" : "positive"}
        />
        <StatCard
          label="Profit"
          value={formatMoneyShort(ledger?.profit ?? 0)}
          sub={`${(ledger?.margin ?? 0).toFixed(1)}% margin · ${formatMoneyShort(ledger?.cost ?? 0)} cost`}
          icon={TrendingUpIcon}
          tone={(ledger?.profit ?? 0) >= 0 ? "positive" : "negative"}
        />
      </div>

      <Tabs defaultValue="costs" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="costs">
            Costs{costs?.length ? ` (${costs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="vehicles">
            Vehicles{assignments?.length ? ` (${assignments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="summary">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="costs" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Everything procured for this trip. Cost drives the profit figure above.
            </p>
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
          </div>

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

        <TabsContent value="vehicles" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Vehicles blocked for this trip&apos;s dates.
            </p>
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Assign vehicle
            </Button>
          </div>

          {!assignments?.length ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              No vehicle assigned yet.
            </div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
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
            <section className="rounded-xl border bg-card">
              <header className="border-b px-5 py-4">
                <h2 className="text-sm font-medium">Cost by category</h2>
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

            <section className="rounded-xl border bg-card">
              <header className="border-b px-5 py-4">
                <h2 className="text-sm font-medium">Money</h2>
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
        bookingId={bookingId}
        cost={editingCost}
      />

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        bookingId={bookingId}
        balance={ledger?.balance ?? 0}
        isFirstPayment={(ledger?.received ?? 0) === 0}
      />

      <AssignVehicleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        bookingId={bookingId}
        startDate={booking.startDate}
        endDate={booking.endDate}
      />

      <BookingFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={booking}
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
