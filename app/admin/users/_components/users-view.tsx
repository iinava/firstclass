"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BanIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
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
import { formatDateTime, initials } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/rbac"
import { qk } from "@/lib/query-keys"
import { USER_ROLES } from "@/validations/user.validation"
import type { UserListRow } from "@/lib/services/user.service"
import { deactivateUser, fetchUsers } from "../actions"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { UserFormDialog } from "./user-form-dialog"

const PAGE_SIZE = 25

/** Roles that can see money — worth flagging in the list. */
const FINANCIAL_ROLES = new Set(["superadmin", "admin", "manager", "accounts"])

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles" },
  ...optionsFrom(USER_ROLES, ROLE_LABELS),
]

const ACTIVE_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

export function UsersView({
  canManage,
  currentUserId,
}: {
  canManage: boolean
  currentUserId: string
}) {
  const { params, setSearch, setFilter, setPage } = useListParams<{
    role: string
    isActive: string
  }>(["role", "isActive"])

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
      role: (params.role || undefined) as never,
      isActive: (params.isActive || undefined) as never,
    }),
    [params.page, params.search, params.sortDir, params.role, params.isActive]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.users.list(queryParams),
    queryFn: async () => unwrapAction(await fetchUsers(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserListRow | null>(null)
  const [resetting, setResetting] = React.useState<UserListRow | null>(null)
  const [deactivating, setDeactivating] = React.useState<UserListRow | null>(null)

  const deactivateMutation = useActionMutation({
    action: deactivateUser,
    successMessage: "Account deactivated",
    invalidate: [qk.users.all],
    onSuccess: () => setDeactivating(null),
  })

  const columns = React.useMemo<DataTableColumn<UserListRow>[]>(
    () => [
      {
        key: "username",
        header: "Account",
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">
              {initials(row.name ?? row.username)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {row.name ?? row.username}
                {row.id === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {row.username}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "role",
        header: "Role",
        cell: (row) => (
          <StatusBadge
            status={row.role}
            label={ROLE_LABELS[row.role]}
            tone={FINANCIAL_ROLES.has(row.role) ? "accent" : "info"}
          />
        ),
      },
      {
        key: "employee",
        header: "Employee",
        hideOnMobile: true,
        cell: (row) => (
          <span className={row.employeeName ? "" : "text-muted-foreground"}>
            {row.employeeName ?? "Not linked"}
          </span>
        ),
      },
      {
        key: "openLeads",
        header: "Open leads",
        hideOnMobile: true,
        cell: (row) => <span className="tabular-nums">{row.openLeads}</span>,
      },
      {
        key: "lastLoginAt",
        header: "Last sign-in",
        hideOnMobile: true,
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Never"}
          </span>
        ),
      },
      {
        key: "isActive",
        header: "Status",
        cell: (row) => (
          <StatusBadge
            status={row.isActive ? "active" : "cancelled"}
            label={row.isActive ? "Active" : "Inactive"}
          />
        ),
      },
      ...(canManage
        ? [
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "w-10",
              cell: (row: UserListRow) => (
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
                    <DropdownMenuItem onClick={() => setResetting(row)}>
                      <KeyRoundIcon className="size-4" />
                      Reset password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={!row.isActive || row.id === currentUserId}
                      onClick={() => setDeactivating(row)}
                    >
                      <BanIcon className="size-4" />
                      Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } satisfies DataTableColumn<UserListRow>,
          ]
        : []),
    ],
    [canManage, currentUserId]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search username, name, email…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search users"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-40"
            aria-label="Filter by role"
            options={ROLE_FILTER_OPTIONS}
            value={params.role ?? ""}
            onValueChange={(value) => setFilter("role", value)}
          />

          <OptionSelect
            className="w-full sm:w-32"
            aria-label="Filter by status"
            options={ACTIVE_FILTER_OPTIONS}
            value={params.isActive ?? ""}
            onValueChange={(value) => setFilter("isActive", value)}
          />
        </div>

        {canManage && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            New account
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle="No accounts found"
        emptyDescription="Create login accounts for staff who need access to this panel."
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

      <UserFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        user={editing}
        isSelf={editing?.id === currentUserId}
      />

      <ResetPasswordDialog
        open={Boolean(resetting)}
        onOpenChange={(open) => !open && setResetting(null)}
        user={resetting}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Deactivate ${deactivating?.username}?`}
        description="They will no longer be able to sign in. The account is kept so their leads, bookings and audit history stay intact."
        confirmLabel="Deactivate"
        variant="destructive"
        isPending={deactivateMutation.isPending}
        onConfirm={() =>
          deactivating && deactivateMutation.mutate({ id: deactivating.id })
        }
      />
    </div>
  )
}
