"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
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
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDate, formatPhone } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/validations/vehicle.validation"
import type { VehicleListRow } from "@/lib/services/vehicle.service"
import type { Driver } from "@/db/schemas/vehicle.schema"
import {
  deleteDriver,
  deleteVehicle,
  fetchDrivers,
  fetchVehicles,
} from "../actions"
import { DriverFormDialog } from "./driver-form-dialog"
import { VehicleFormDialog } from "./vehicle-form-dialog"

const PAGE_SIZE = 25

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "All types" },
  ...optionsFrom(VEHICLE_TYPES, VEHICLE_TYPE_LABELS),
]

const OWNERSHIP_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "hired", label: "Hired" },
]

/** Flags documents expiring within 30 days — the thing that grounds a vehicle. */
function expiryTone(date: string | null): "danger" | "warn" | null {
  if (!date) return null
  const days = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  if (days < 0) return "danger"
  if (days <= 30) return "warn"
  return null
}

export function FleetView() {
  const { params, setSearch, setFilter, setPage, setSort } = useListParams<{
    type: string
    ownership: string
  }>(["type", "ownership"])

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
      ownership: (params.ownership || undefined) as never,
    }),
    [params.page, params.search, params.sortBy, params.sortDir, params.type, params.ownership]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.vehicles.list(queryParams),
    queryFn: async () => unwrapAction(await fetchVehicles(queryParams)),
    placeholderData: (previous) => previous,
  })

  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: qk.drivers.list(),
    queryFn: async () => unwrapAction(await fetchDrivers({ search: undefined })),
  })

  const [vehicleFormOpen, setVehicleFormOpen] = React.useState(false)
  const [editingVehicle, setEditingVehicle] = React.useState<VehicleListRow | null>(null)
  const [deletingVehicle, setDeletingVehicle] = React.useState<VehicleListRow | null>(null)

  const [driverFormOpen, setDriverFormOpen] = React.useState(false)
  const [editingDriver, setEditingDriver] = React.useState<Driver | null>(null)
  const [deletingDriver, setDeletingDriver] = React.useState<Driver | null>(null)

  const removeVehicle = useActionMutation({
    action: deleteVehicle,
    successMessage: "Vehicle deleted",
    invalidate: [qk.vehicles.all],
    onSuccess: () => setDeletingVehicle(null),
  })

  const removeDriver = useActionMutation({
    action: deleteDriver,
    successMessage: "Driver removed",
    invalidate: [qk.drivers.all],
    onSuccess: () => setDeletingDriver(null),
  })

  const vehicleColumns = React.useMemo<DataTableColumn<VehicleListRow>[]>(
    () => [
      {
        key: "regNumber",
        header: "Vehicle",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium font-mono">{row.regNumber}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[row.make, row.model].filter(Boolean).join(" ") ||
                VEHICLE_TYPE_LABELS[row.type]}{" "}
              · {row.seatingCapacity} seats
            </p>
          </div>
        ),
      },
      {
        key: "ownership",
        header: "Ownership",
        cell: (row) => (
          <div>
            <StatusBadge
              status={row.ownership}
              label={row.ownership === "owned" ? "Owned" : "Hired"}
              tone={row.ownership === "owned" ? "success" : "info"}
            />
            {row.supplierName && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {row.supplierName}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "driver",
        header: "Default driver",
        hideOnMobile: true,
        cell: (row) => (
          <span className={row.driverName ? "" : "text-muted-foreground"}>
            {row.driverName ?? "—"}
          </span>
        ),
      },
      {
        key: "expiry",
        header: "Documents",
        hideOnMobile: true,
        cell: (row) => {
          const flags = [
            { label: "Insurance", date: row.insuranceExpiry },
            { label: "Fitness", date: row.fitnessExpiry },
            { label: "PUC", date: row.pucExpiry },
          ]
            .map((f) => ({ ...f, tone: expiryTone(f.date) }))
            .filter((f) => f.tone)

          if (flags.length === 0) {
            return <span className="text-xs text-muted-foreground">OK</span>
          }
          return (
            <div className="flex flex-col gap-0.5">
              {flags.map((flag) => (
                <span
                  key={flag.label}
                  className={
                    flag.tone === "danger"
                      ? "inline-flex items-center gap-1 text-xs text-red-500"
                      : "inline-flex items-center gap-1 text-xs text-amber-500"
                  }
                >
                  <AlertTriangleIcon className="size-3" />
                  {flag.label} {flag.tone === "danger" ? "expired" : "due"}{" "}
                  {formatDate(flag.date)}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        key: "usage",
        header: "Usage",
        hideOnMobile: true,
        cell: (row) => (
          <div className="tabular-nums text-xs text-muted-foreground">
            <p>
              {row.tripCount} trip{row.tripCount === 1 ? "" : "s"}
            </p>
            <p>{formatMoneyShort(row.totalExpense)} spent</p>
          </div>
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
                  setEditingVehicle(row)
                  setVehicleFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeletingVehicle(row)}
              >
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

  const driverColumns = React.useMemo<DataTableColumn<Driver>[]>(
    () => [
      {
        key: "name",
        header: "Driver",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.licenseNumber && (
              <p className="truncate text-xs text-muted-foreground">
                Licence {row.licenseNumber}
              </p>
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
        key: "licenseExpiry",
        header: "Licence expiry",
        hideOnMobile: true,
        cell: (row) => {
          const tone = expiryTone(row.licenseExpiry)
          return (
            <span
              className={
                tone === "danger"
                  ? "text-red-500"
                  : tone === "warn"
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }
            >
              {formatDate(row.licenseExpiry)}
            </span>
          )
        },
      },
      {
        key: "allowance",
        header: "Daily bata",
        hideOnMobile: true,
        cell: (row) =>
          row.dailyAllowance ? (
            <span className="tabular-nums">{formatMoneyShort(row.dailyAllowance)}</span>
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
                  setEditingDriver(row)
                  setDriverFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeletingDriver(row)}
              >
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
    <Tabs defaultValue="vehicles" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
        <TabsTrigger value="drivers">
          Drivers{drivers?.length ? ` (${drivers.length})` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vehicles" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="w-full sm:max-w-xs">
              <InputGroupInput
                placeholder="Search registration, make…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Search vehicles"
              />
              <InputGroupAddon>
                <SearchIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>

            <OptionSelect
              className="w-full sm:w-44"
              aria-label="Filter by type"
              options={TYPE_FILTER_OPTIONS}
              value={params.type ?? ""}
              onValueChange={(value) => setFilter("type", value)}
            />

            <OptionSelect
              className="w-full sm:w-32"
              aria-label="Filter by ownership"
              options={OWNERSHIP_FILTER_OPTIONS}
              value={params.ownership ?? ""}
              onValueChange={(value) => setFilter("ownership", value)}
            />
          </div>

          <Button
            onClick={() => {
              setEditingVehicle(null)
              setVehicleFormOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add vehicle
          </Button>
        </div>

        <DataTable
          columns={vehicleColumns}
          rows={data?.rows}
          getRowId={(row) => row.id}
          isLoading={isLoading || isFetching}
          emptyTitle="No vehicles yet"
          emptyDescription="Add owned or regularly hired vehicles so they can be assigned to trips."
          onRowClick={(row) => {
            setEditingVehicle(row)
            setVehicleFormOpen(true)
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
      </TabsContent>

      <TabsContent value="drivers" className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditingDriver(null)
              setDriverFormOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add driver
          </Button>
        </div>

        <DataTable
          columns={driverColumns}
          rows={drivers}
          getRowId={(row) => row.id}
          isLoading={driversLoading}
          emptyTitle="No drivers yet"
          emptyDescription="Add drivers to assign them to vehicles and trips."
          onRowClick={(row) => {
            setEditingDriver(row)
            setDriverFormOpen(true)
          }}
        />
      </TabsContent>

      <VehicleFormDialog
        open={vehicleFormOpen}
        onOpenChange={(open) => {
          setVehicleFormOpen(open)
          if (!open) setEditingVehicle(null)
        }}
        vehicle={editingVehicle}
      />

      <DriverFormDialog
        open={driverFormOpen}
        onOpenChange={(open) => {
          setDriverFormOpen(open)
          if (!open) setEditingDriver(null)
        }}
        driver={editingDriver}
      />

      <ConfirmDialog
        open={Boolean(deletingVehicle)}
        onOpenChange={(open) => !open && setDeletingVehicle(null)}
        title={`Delete ${deletingVehicle?.regNumber}?`}
        description="Vehicles with trip assignments can't be deleted — mark them inactive instead."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeVehicle.isPending}
        onConfirm={() =>
          deletingVehicle && removeVehicle.mutate({ id: deletingVehicle.id })
        }
      />

      <ConfirmDialog
        open={Boolean(deletingDriver)}
        onOpenChange={(open) => !open && setDeletingDriver(null)}
        title={`Remove ${deletingDriver?.name}?`}
        description="The driver is archived. Past trip records keep their name."
        confirmLabel="Remove"
        variant="destructive"
        isPending={removeDriver.isPending}
        onConfirm={() => deletingDriver && removeDriver.mutate({ id: deletingDriver.id })}
      />
    </Tabs>
  )
}
