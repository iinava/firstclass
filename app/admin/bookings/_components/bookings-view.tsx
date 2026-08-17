"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPax } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
} from "@/validations/booking.validation"
import type { BookingListRow } from "@/lib/services/booking.service"
import { fetchBookings } from "../actions"
import { BookingFormDialog } from "./booking-form-dialog"

const PAGE_SIZE = 25

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...optionsFrom(BOOKING_STATUSES, BOOKING_STATUS_LABELS),
]

export function BookingsView() {
  // "startDate" must match the default in the page's server prefetch.
  const { params, setSearch, setFilter, setPage, setSort } = useListParams<{
    status: string
  }>(["status"], "startDate")

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
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      status: (params.status || undefined) as never,
    }),
    [params.page, params.search, params.sortBy, params.sortDir, params.status]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.bookings.list(queryParams),
    queryFn: async () => unwrapAction(await fetchBookings(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)

  const columns = React.useMemo<DataTableColumn<BookingListRow>[]>(
    () => [
      {
        key: "code",
        header: "Trip",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.code} · {row.customerName}
            </p>
          </div>
        ),
      },
      {
        key: "startDate",
        header: "Dates",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap">{formatDate(row.startDate)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPax(row.adults, row.children, row.infants)}
            </p>
          </div>
        ),
      },
      {
        key: "grandTotal",
        header: "Value",
        sortable: true,
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums">{formatMoneyShort(row.grandTotal)}</span>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        hideOnMobile: true,
        cell: (row) => (
          <div className="tabular-nums">
            <p
              className={cn(
                row.balance > 0 ? "text-amber-500" : "text-emerald-500"
              )}
            >
              {row.balance > 0 ? formatMoneyShort(row.balance) : "Settled"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMoneyShort(row.received)} received
            </p>
          </div>
        ),
      },
      {
        key: "profit",
        header: "Profit",
        hideOnMobile: true,
        cell: (row) => (
          <span
            className={cn(
              "tabular-nums",
              row.profit >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {formatMoneyShort(row.profit)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">Open</span>,
        className: "w-10",
        cell: (row) => (
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href={`/admin/bookings/${row.id}`} />}
            aria-label={`Open ${row.code}`}
          >
            <ExternalLinkIcon className="size-4" />
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search code, trip, customer…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search bookings"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-40"
            aria-label="Filter by status"
            options={STATUS_FILTER_OPTIONS}
            value={params.status ?? ""}
            onValueChange={(value) => setFilter("status", value)}
          />
        </div>

        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          New booking
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle={params.search ? "No matching bookings" : "No bookings yet"}
        emptyDescription="Confirm a trip from an enquiry, or create one directly."
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
        sort={{ sortBy: params.sortBy, sortDir: params.sortDir, onSortChange: setSort }}
      />

      <BookingFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
