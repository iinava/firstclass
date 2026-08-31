"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPax } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
} from "@/validations/booking.validation"
import type { BookingListRow } from "@/lib/services/booking.service"
import { fetchBookings } from "../actions"
import { TripFormDialog } from "./trip-form-dialog"

const PAGE_SIZE = 25

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...optionsFrom(BOOKING_STATUSES, BOOKING_STATUS_LABELS),
]

export function TripsView() {
  const router = useRouter()

  const { params, setSearch, setFilter, setPage, setSort } = useListParams<{
    status: string
    from: string
    to: string
  }>(["status", "from", "to"])

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
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    [
      params.page,
      params.search,
      params.sortBy,
      params.sortDir,
      params.status,
      params.from,
      params.to,
    ]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.bookings.list(queryParams),
    queryFn: async () => unwrapAction(await fetchBookings(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)

  /**
   * Four columns, not seven. Value / Balance / Received / Profit were four
   * separate money columns saying one thing — "where is this trip's money" —
   * and profit is an internal figure nobody scans a list for. They collapse
   * into one plain-language line, with the detail page carrying the rest.
   */
  const columns = React.useMemo<DataTableColumn<BookingListRow>[]>(
    () => [
      {
        key: "code",
        header: "Trip",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.title}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.customerName}
            </p>
          </div>
        ),
      },
      {
        key: "startDate",
        header: "Travelling",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[15px]">
              {formatDate(row.startDate)}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {formatPax(row.adults, row.children, row.infants)}
            </p>
          </div>
        ),
      },
      {
        key: "balance",
        header: "Payment",
        hideOnMobile: true,
        cell: (row) =>
          // Nothing is "to collect" on a trip that was called off.
          row.status === "cancelled" ? (
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[15px] text-muted-foreground">
                {row.received > 0
                  ? `${formatMoneyShort(row.received)} taken`
                  : "Nothing taken"}
              </p>
              <p className="text-[13px] text-muted-foreground">Trip cancelled</p>
            </div>
          ) : row.balance > 0 ? (
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[15px] text-amber-600 dark:text-amber-400">
                {formatMoneyShort(row.balance)} to collect
              </p>
              <p className="text-[13px] text-muted-foreground">
                of {formatMoneyShort(row.grandTotal)}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[15px] text-emerald-600 dark:text-emerald-400">
                Fully paid
              </p>
              <p className="text-[13px] text-muted-foreground">
                {formatMoneyShort(row.grandTotal)}
              </p>
            </div>
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
        cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search trip or customer…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search trips"
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

          <DateRangeFilter
            from={params.from}
            to={params.to}
            onChange={(range) => {
              setFilter("from", range.from ?? null)
              setFilter("to", range.to ?? null)
            }}
            placeholder="Travel dates"
            className="w-full sm:w-auto"
          />
        </div>

        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          New trip
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        // The whole row is the target now that the open-icon column is gone.
        onRowClick={(row) => router.push(`/admin/trips/${row.id}`)}
        isLoading={isLoading || isFetching}
        emptyTitle={params.search ? "No matching trips" : "No trips yet"}
        emptyDescription="Convert an enquiry, or create a trip directly."
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

      <TripFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
