"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatPhone } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
} from "@/validations/supplier.validation"
import type { SupplierListRow } from "@/lib/services/supplier.service"
import { deleteSupplier, fetchSuppliers } from "../actions"
import { SupplierFormDialog } from "./supplier-form-dialog"

const PAGE_SIZE = 25

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "All types" },
  ...optionsFrom(SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS),
]

const ACTIVE_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

export function SuppliersView() {
  const { params, setSearch, setFilter, setPage, setSort } = useListParams<{
    type: string
    isActive: string
  }>(["type", "isActive"])

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
      type: (params.type || undefined) as never,
      isActive: (params.isActive || undefined) as never,
    }),
    [params.page, params.search, params.sortBy, params.sortDir, params.type, params.isActive]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.suppliers.list(queryParams),
    queryFn: async () => unwrapAction(await fetchSuppliers(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SupplierListRow | null>(null)
  const [deleting, setDeleting] = React.useState<SupplierListRow | null>(null)

  const removeMutation = useActionMutation({
    action: deleteSupplier,
    successMessage: "Supplier deleted",
    invalidate: [qk.suppliers.all],
    onSuccess: () => setDeleting(null),
  })

  const columns = React.useMemo<DataTableColumn<SupplierListRow>[]>(
    () => [
      {
        key: "name",
        header: "Supplier",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.name}
              {!row.isActive && (
                <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.contactPerson ?? row.city ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        cell: (row) => (
          <StatusBadge
            status={row.type}
            label={SUPPLIER_TYPE_LABELS[row.type]}
            tone="info"
          />
        ),
      },
      {
        key: "phone",
        header: "Phone",
        hideOnMobile: true,
        cell: (row) =>
          row.phone ? (
            <a
              href={`tel:${row.phone}`}
              className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <PhoneIcon className="size-3 text-muted-foreground" />
              {formatPhone(row.phone)}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "spend",
        header: "Total spend",
        hideOnMobile: true,
        cell: (row) => (
          <div className="tabular-nums">
            <p>{formatMoneyShort(row.totalSpend)}</p>
            {row.outstanding > 0 && (
              <p className="text-xs text-amber-500">
                {formatMoneyShort(row.outstanding)} due
              </p>
            )}
          </div>
        ),
      },
      {
        key: "rating",
        header: "Rating",
        hideOnMobile: true,
        cell: (row) =>
          row.rating ? (
            <span className="inline-flex items-center gap-1">
              <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
              {row.rating}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
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
              placeholder="Search name, city, contact…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search suppliers"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-40"
            aria-label="Filter by type"
            options={TYPE_FILTER_OPTIONS}
            value={params.type ?? ""}
            onValueChange={(value) => setFilter("type", value)}
          />

          <OptionSelect
            className="w-full sm:w-32"
            aria-label="Filter by status"
            options={ACTIVE_FILTER_OPTIONS}
            value={params.isActive ?? ""}
            onValueChange={(value) => setFilter("isActive", value)}
          />
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Add supplier
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle={params.search ? "No matching suppliers" : "No suppliers yet"}
        emptyDescription="Add the hotels and transporters you work with so trip costs can reference them."
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
        sort={{ sortBy: params.sortBy, sortDir: params.sortDir, onSortChange: setSort }}
      />

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        supplier={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Suppliers referenced by trip costs can't be deleted — mark them inactive instead."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
