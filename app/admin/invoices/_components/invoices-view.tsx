"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, MoreHorizontalIcon, SearchIcon, XCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
} from "@/validations/accounts.validation"
import type { InvoiceListRow } from "@/lib/services/accounts.service"
import { cancelInvoice, fetchInvoices } from "@/app/admin/accounts-actions"

const PAGE_SIZE = 25

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...optionsFrom(INVOICE_STATUSES, INVOICE_STATUS_LABELS),
]

export function InvoicesView() {
  const { params, setSearch, setFilter, setPage } = useListParams<{ status: string }>([
    "status",
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
      status: (params.status || undefined) as never,
    }),
    [params.page, params.search, params.sortDir, params.status]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.accounts.invoices(queryParams),
    queryFn: async () => unwrapAction(await fetchInvoices(queryParams)),
    placeholderData: (previous) => previous,
  })

  const cancelMutation = useActionMutation({
    action: cancelInvoice,
    successMessage: "Invoice cancelled",
    invalidate: [qk.accounts.all],
  })

  const columns = React.useMemo<DataTableColumn<InvoiceListRow>[]>(
    () => [
      {
        key: "number",
        header: "Invoice",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium font-mono">{row.number}</p>
            <p className="truncate text-xs text-muted-foreground">{row.customerName}</p>
          </div>
        ),
      },
      {
        key: "booking",
        header: "Trip",
        hideOnMobile: true,
        cell: (row) => (
          <Link
            href={`/admin/bookings/${row.bookingId}`}
            className="font-mono text-xs hover:underline"
          >
            {row.bookingCode}
          </Link>
        ),
      },
      {
        key: "issueDate",
        header: "Issued",
        cell: (row) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.issueDate)}
          </span>
        ),
      },
      {
        key: "total",
        header: "Total",
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.total)}</span>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        hideOnMobile: true,
        cell: (row) => (
          <span
            className={cn(
              "tabular-nums",
              row.balance > 0 ? "text-amber-500" : "text-emerald-500"
            )}
          >
            {row.balance > 0 ? formatMoneyShort(row.balance) : "Paid"}
          </span>
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
        className: "w-10",
        cell: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/admin/bookings/${row.bookingId}`} />}>
                <ExternalLinkIcon className="size-4" />
                Open trip
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={row.amountPaid > 0 || row.status === "cancelled"}
                onClick={() =>
                  cancelMutation.mutate({
                    id: row.id,
                    reason: "Cancelled from invoice list",
                  } as never)
                }
              >
                <XCircleIcon className="size-4" />
                Cancel invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [cancelMutation]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupInput
            placeholder="Search invoice, customer, trip…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search invoices"
          />
          <InputGroupAddon>
            <SearchIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>

        <OptionSelect
          className="w-full sm:w-44"
          aria-label="Filter by status"
          options={STATUS_FILTER_OPTIONS}
          value={params.status ?? ""}
          onValueChange={(value) => setFilter("status", value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle="No invoices yet"
        emptyDescription="Raise an invoice from a booking — it picks up the trip's stored totals."
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
    </div>
  )
}
