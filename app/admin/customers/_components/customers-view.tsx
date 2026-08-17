"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { useActionMutation, unwrapAction } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPhone } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import { LEAD_SOURCES, SOURCE_LABELS } from "@/validations/customer.validation"
import type { CustomerListRow } from "@/lib/services/customer.service"
import { deleteCustomer, fetchCustomers } from "../actions"
import { CustomerFormDialog } from "./customer-form-dialog"

const FILTER_KEYS = ["source"] as const
const PAGE_SIZE = 25

const SOURCE_FILTER_OPTIONS = [
  { value: "", label: "All sources" },
  ...optionsFrom(LEAD_SOURCES, SOURCE_LABELS),
]

export function CustomersView() {
  const { params, setSearch, setFilter, setPage, setSort } =
    useListParams<{ source: string }>([...FILTER_KEYS])

  // Keep the input responsive while the query waits for a pause in typing.
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
      source: (params.source || undefined) as never,
    }),
    [params.page, params.search, params.sortBy, params.sortDir, params.source]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.customers.list(queryParams),
    queryFn: async () => unwrapAction(await fetchCustomers(queryParams)),
    // Keeps the previous page's rows on screen while the next page loads,
    // so pagination never flashes an empty table.
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomerListRow | null>(null)
  const [deleting, setDeleting] = React.useState<CustomerListRow | null>(null)

  const removeMutation = useActionMutation({
    action: deleteCustomer,
    successMessage: "Customer deleted",
    invalidate: [qk.customers.all],
    onSuccess: () => setDeleting(null),
  })

  const columns = React.useMemo<DataTableColumn<CustomerListRow>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.city && (
              <p className="truncate text-xs text-muted-foreground">{row.city}</p>
            )}
          </div>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        cell: (row) => (
          <a
            href={`tel:${row.phone}`}
            className="tabular-nums hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {formatPhone(row.phone)}
          </a>
        ),
      },
      {
        key: "source",
        header: "Source",
        hideOnMobile: true,
        cell: (row) => (
          <StatusBadge status={row.source} label={SOURCE_LABELS[row.source]} />
        ),
      },
      {
        key: "activity",
        header: "Activity",
        hideOnMobile: true,
        cell: (row) => (
          <span className="text-muted-foreground text-xs">
            {row.leadCount} enquir{row.leadCount === 1 ? "y" : "ies"} ·{" "}
            {row.bookingCount} trip{row.bookingCount === 1 ? "" : "s"}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Added",
        sortable: true,
        hideOnMobile: true,
        cell: (row) => (
          <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>
        ),
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
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              placeholder="Search name, phone, email…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search customers"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-44"
            aria-label="Filter by source"
            options={SOURCE_FILTER_OPTIONS}
            value={params.source ?? ""}
            onValueChange={(value) => setFilter("source", value)}
          />
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Add customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        skeletonRows={8}
        emptyTitle={params.search ? "No matching customers" : "No customers yet"}
        emptyDescription={
          params.search
            ? "Try a different name or phone number."
            : "Add your first customer, or one will be created automatically with your first enquiry."
        }
        onRowClick={(row) => {
          setEditing(row)
          setFormOpen(true)
        }}
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
        sort={{
          sortBy: params.sortBy,
          sortDir: params.sortDir,
          onSortChange: setSort,
        }}
      />

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        customer={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="The record is archived, not erased — it stays available in reports and audit history. Customers with bookings cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
