"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PhoneIcon, SearchIcon, XCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Meter } from "@/components/shared/charts"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPhone } from "@/lib/format"
import { formatMoneyCompact, formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@/validations/accounts.validation"
import type { ReceiptListRow } from "@/lib/services/accounts.service"
import {
  fetchOutstanding,
  fetchReceipts,
  voidReceipt,
} from "@/app/admin/accounts-actions"

const PAGE_SIZE = 25

const MODE_FILTER_OPTIONS = [
  { value: "", label: "All modes" },
  ...optionsFrom(PAYMENT_MODES, PAYMENT_MODE_LABELS),
]

interface OutstandingRow {
  bookingId: string
  code: string
  title: string
  endDate: string
  status: string
  customerName: string
  customerPhone: string
  grandTotal: number
  received: number
  balance: number
}

export function PaymentsView() {
  const { params, setSearch, setFilter, setPage } = useListParams<{ mode: string }>([
    "mode",
  ])

  const [searchInput, setSearchInput] = React.useState(params.search)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  React.useEffect(() => {
    if (debouncedSearch !== params.search) setSearch(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const queryParams = React.useMemo(
    () => ({
      page: params.page,
      pageSize: PAGE_SIZE,
      search: params.search || undefined,
      sortDir: params.sortDir,
      mode: (params.mode || undefined) as never,
    }),
    [params.page, params.search, params.sortDir, params.mode]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.accounts.receipts(queryParams),
    queryFn: async () => unwrapAction(await fetchReceipts(queryParams)),
    placeholderData: (previous) => previous,
  })

  const { data: outstanding, isLoading: outstandingLoading } = useQuery({
    queryKey: qk.accounts.outstanding(),
    queryFn: async () => unwrapAction(await fetchOutstanding()),
  })

  const [voiding, setVoiding] = React.useState<ReceiptListRow | null>(null)

  const voidMutation = useActionMutation({
    action: voidReceipt,
    successMessage: "Receipt voided",
    invalidate: [qk.accounts.all, qk.bookings.all],
    onSuccess: () => setVoiding(null),
  })

  const totalDue = (outstanding ?? []).reduce(
    (sum: number, row: OutstandingRow) => sum + row.balance,
    0
  )

  const receiptColumns = React.useMemo<DataTableColumn<ReceiptListRow>[]>(
    () => [
      {
        key: "number",
        header: "Receipt",
        cell: (row) => (
          <div className="min-w-0">
            <p
              className={
                row.voidedAt
                  ? "truncate font-mono font-medium line-through opacity-60"
                  : "truncate font-mono font-medium"
              }
            >
              {row.number}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">{row.customerName}</p>
          </div>
        ),
      },
      {
        key: "booking",
        header: "Trip",
        hideOnMobile: true,
        cell: (row) => (
          <Link
            href={`/admin/trips/${row.bookingId}`}
            className="font-mono text-xs hover:underline"
          >
            {row.bookingCode}
          </Link>
        ),
      },
      {
        key: "amount",
        align: "right",
        header: "Amount",
        cell: (row) => (
          <div className="tabular-nums">
            <p className={row.voidedAt ? "line-through opacity-60" : ""}>
              {formatMoneyShort(row.amount)}
            </p>
            {row.isAdvance && <p className="text-xs text-blue-500">Advance</p>}
          </div>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        hideOnMobile: true,
        cell: (row) => (
          <StatusBadge
            status={row.mode}
            label={PAYMENT_MODE_LABELS[row.mode as never]}
            tone="neutral"
          />
        ),
      },
      {
        key: "receivedAt",
        header: "Date",
        cell: (row) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.receivedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-10",
        cell: (row) =>
          row.voidedAt ? (
            <span className="text-xs text-muted-foreground">Void</span>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Void receipt"
              onClick={() => setVoiding(row)}
            >
              <XCircleIcon className="size-4" />
            </Button>
          ),
      },
    ],
    []
  )

  const outstandingColumns = React.useMemo<DataTableColumn<OutstandingRow>[]>(
    () => [
      {
        key: "customer",
        header: "Customer",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.customerName}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.code} · {row.title}
            </p>
          </div>
        ),
      },
      {
        key: "phone",
        header: "Contact",
        hideOnMobile: true,
        cell: (row) => (
          <a
            href={`tel:${row.customerPhone}`}
            className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
          >
            <PhoneIcon className="size-3 text-muted-foreground" />
            {formatPhone(row.customerPhone)}
          </a>
        ),
      },
      {
        key: "endDate",
        header: "Trip ends",
        cell: (row) => {
          const overdue = new Date(row.endDate) < new Date()
          return (
            <span className={overdue ? "text-red-500" : "text-muted-foreground"}>
              {formatDate(row.endDate)}
            </span>
          )
        },
      },
      {
        key: "received",
        header: "Collected",
        hideOnMobile: true,
        className: "w-52",
        // A meter rather than two numbers: the reader wants "how far along",
        // and the figures stay on the row so it is never colour alone.
        cell: (row) => (
          <Meter value={row.received} total={row.grandTotal} label="" />
        ),
      },
      {
        key: "receivedText",
        header: "Received",
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoneyShort(row.received)} of {formatMoneyShort(row.grandTotal)}
          </span>
        ),
      },
      {
        key: "balance",
        align: "right",
        header: "Due",
        cell: (row) => (
          <span className="tabular-nums font-medium text-amber-500">
            {formatMoneyShort(row.balance)}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Open</span>,
        className: "w-24",
        cell: (row) => (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/admin/trips/${row.bookingId}`} />}
          >
            Collect
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <Tabs defaultValue="outstanding" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="outstanding">
          Outstanding{outstanding?.length ? ` (${outstanding.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="receipts">Receipts</TabsTrigger>
      </TabsList>

      <TabsContent value="outstanding" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total outstanding"
            value={formatMoneyCompact(totalDue)}
            sub={`Across ${outstanding?.length ?? 0} trips`}
            tone="warning"
          />
        </div>

        <DataTable
          columns={outstandingColumns}
          rows={outstanding as OutstandingRow[] | undefined}
          getRowId={(row) => row.bookingId}
          isLoading={outstandingLoading}
          emptyTitle="Nothing outstanding"
          emptyDescription="Every confirmed trip has been paid in full."
        />
      </TabsContent>

      <TabsContent value="receipts" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search receipt, customer, reference…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search receipts"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-44"
            aria-label="Filter by mode"
            options={MODE_FILTER_OPTIONS}
            value={params.mode ?? ""}
            onValueChange={(value) => setFilter("mode", value)}
          />
        </div>

        <DataTable
          columns={receiptColumns}
          rows={data?.rows}
          getRowId={(row) => row.id}
          isLoading={isLoading || isFetching}
          emptyTitle="No payments recorded"
          emptyDescription="Record payments from a trip page as they come in."
          pagination={
            data
              ? {
                  page: data.page,
                  pageCount: data.pageCount,
                  total: data.total,
                  pageSize: data.pageSize,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </TabsContent>

      <ConfirmDialog
        open={Boolean(voiding)}
        onOpenChange={(open) => !open && setVoiding(null)}
        title={`Void receipt ${voiding?.number}?`}
        description="The receipt stays in the ledger marked void, and the amount is reversed off the invoice. This cannot be undone."
        confirmLabel="Void receipt"
        variant="destructive"
        isPending={voidMutation.isPending}
        onConfirm={() =>
          voiding &&
          voidMutation.mutate({ id: voiding.id, reason: "Voided from payments list" })
        }
      />
    </Tabs>
  )
}
