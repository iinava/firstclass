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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { OptionSelect } from "@/components/shared/option-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPhone } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import type { EmployeeListRow } from "@/lib/services/hrms.service"
import { deleteEmployee, fetchEmployees } from "../actions"
import { EmployeeFormDialog } from "./employee-form-dialog"

const PAGE_SIZE = 25

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
]

export function EmployeesView() {
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
    queryKey: qk.hrms.employees(queryParams),
    queryFn: async () => unwrapAction(await fetchEmployees(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EmployeeListRow | null>(null)
  const [deleting, setDeleting] = React.useState<EmployeeListRow | null>(null)

  const removeMutation = useActionMutation({
    action: deleteEmployee,
    successMessage: "Employee removed",
    invalidate: [qk.hrms.all],
    onSuccess: () => setDeleting(null),
  })

  const columns = React.useMemo<DataTableColumn<EmployeeListRow>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.empCode}
              {row.designation ? ` · ${row.designation}` : ""}
            </p>
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
        key: "department",
        header: "Department",
        hideOnMobile: true,
        cell: (row) => (
          <span className={row.department ? "" : "text-muted-foreground"}>
            {row.department ?? "—"}
          </span>
        ),
      },
      {
        key: "attendance",
        header: "This month",
        hideOnMobile: true,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {row.presentThisMonth} day{row.presentThisMonth === 1 ? "" : "s"}
          </span>
        ),
      },
      {
        key: "salary",
        header: "Salary",
        hideOnMobile: true,
        cell: (row) =>
          row.monthlySalary ? (
            <span className="tabular-nums">{formatMoneyShort(row.monthlySalary)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "joined",
        header: "Joined",
        hideOnMobile: true,
        cell: (row) => (
          <span className="text-muted-foreground">{formatDate(row.dateOfJoining)}</span>
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
                Remove
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
              placeholder="Search name, code, designation…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search employees"
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

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Add employee
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle="No employees yet"
        emptyDescription="Add your team so attendance and leave can be tracked."
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
      />

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        employee={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        description="The record is archived. Past attendance and leave history are kept."
        confirmLabel="Remove"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
