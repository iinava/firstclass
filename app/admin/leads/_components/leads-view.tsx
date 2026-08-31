"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RouteIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { formatDate, formatPhone, formatRelativeDay } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from "@/validations/lead.validation"
import type { LeadListRow } from "@/lib/services/lead.service"
import {
  deleteLead,
  fetchLeadStats,
  fetchLeads,
  updateLeadStatus,
} from "../actions"
import { LeadFormDialog } from "./lead-form-dialog"
import { LeadStatsTiles } from "./lead-stats-tiles"
import { ScheduleFollowupDialog } from "@/app/admin/followups/_components/schedule-followup-dialog"
import { TripFormDialog } from "@/app/admin/trips/_components/trip-form-dialog"

const FILTER_KEYS = ["status", "priority", "assignedTo", "from", "to"] as const
const PAGE_SIZE = 25

// "" excludes won enquiries by default — see listLeads. Selecting "Won"
// explicitly still shows them.
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All open stages" },
  ...optionsFrom(LEAD_STATUSES, LEAD_STATUS_LABELS),
]

const PRIORITY_FILTER_OPTIONS = [
  { value: "", label: "Any priority" },
  ...LEAD_PRIORITIES.map((priority) => ({
    value: priority,
    label: priority[0].toUpperCase() + priority.slice(1),
  })),
]

export function LeadsView() {
  const { params, setSearch, setFilter, setPage, setSort } = useListParams<{
    status: string
    priority: string
    assignedTo: string
    from: string
    to: string
  }>([...FILTER_KEYS])

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
      priority: (params.priority || undefined) as never,
      assignedTo: params.assignedTo || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    [
      params.page,
      params.search,
      params.sortBy,
      params.sortDir,
      params.status,
      params.priority,
      params.assignedTo,
      params.from,
      params.to,
    ]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.leads.list(queryParams),
    queryFn: async () => unwrapAction(await fetchLeads(queryParams)),
    placeholderData: (previous) => previous,
  })

  const { data: stats } = useQuery({
    queryKey: qk.leads.stats(),
    queryFn: async () => unwrapAction(await fetchLeadStats()),
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<LeadListRow | null>(null)
  const [deleting, setDeleting] = React.useState<LeadListRow | null>(null)
  const [schedulingFor, setSchedulingFor] = React.useState<LeadListRow | null>(null)
  const [convertingLead, setConvertingLead] = React.useState<LeadListRow | null>(null)

  const statusMutation = useActionMutation({
    action: updateLeadStatus,
    successMessage: "Stage updated",
    invalidate: [qk.leads.all, qk.followups.all],
  })

  const removeMutation = useActionMutation({
    action: deleteLead,
    successMessage: "Enquiry deleted",
    invalidate: [qk.leads.all],
    onSuccess: () => setDeleting(null),
  })

  const columns = React.useMemo<DataTableColumn<LeadListRow>[]>(
    () => [
      {
        key: "code",
        header: "Customer",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.customerName}</p>
            {/* The phone was its own column; it belongs with the name, and
                tapping it should still dial without opening the row. */}
            <a
              href={`tel:${row.customerPhone}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <PhoneIcon className="size-3" />
              {formatPhone(row.customerPhone)}
            </a>
          </div>
        ),
      },
      {
        key: "destination",
        header: "Wants",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px]">{row.destination ?? "Not said yet"}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.travelDate ? formatDate(row.travelDate) : "Date TBD"} ·{" "}
              {row.adults + row.children} pax
              {row.budget ? ` · ${formatMoneyShort(row.budget)} budget` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "nextFollowup",
        header: "Next call",
        hideOnMobile: true,
        cell: (row) =>
          row.nextFollowupAt ? (
            <span
              className={cn(
                "text-[15px]",
                new Date(row.nextFollowupAt) < new Date()
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {formatRelativeDay(row.nextFollowupAt)}
            </span>
          ) : (
            <span className="text-[15px] text-amber-600 dark:text-amber-400">
              Not scheduled
            </span>
          ),
      },
      {
        key: "status",
        header: "Stage",
        sortable: true,
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-36",
        cell: (row) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Winning the enquiry is the whole point of this table, so it is a
                visible button rather than a menu item three clicks deep. A won
                enquiry has already become a trip — there's nothing left to
                convert, so the button simply disappears. */}
            {row.status !== "lost" && row.status !== "won" && (
              <Button variant="outline" size="sm" onClick={() => setConvertingLead(row)}>
                <RouteIcon data-icon="inline-start" />
                Convert
              </Button>
            )}

            <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit enquiry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSchedulingFor(row)}>
                <CalendarPlusIcon className="size-4" />
                Schedule follow-up
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              {/* The label is a group part — outside DropdownMenuGroup Base UI
                  throws and the whole page falls into the error boundary. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move to stage
                </DropdownMenuLabel>
                {LEAD_STATUSES.filter((status) => status !== row.status).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: row.id,
                        status,
                        // "Lost" requires a reason; the menu can't collect one, so
                        // it records a default the user can edit on the lead.
                        lostReason:
                          status === "lost" ? "Marked lost from list" : undefined,
                      } as never)
                    }
                  >
                    {LEAD_STATUS_LABELS[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [statusMutation]
  )

  return (
    <div className="flex flex-col gap-4">
      <LeadStatsTiles stats={stats} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search name, phone or destination…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search leads"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-36"
            aria-label="Filter by stage"
            options={STATUS_FILTER_OPTIONS}
            value={params.status ?? ""}
            onValueChange={(value) => setFilter("status", value)}
          />

          <OptionSelect
            className="w-full sm:w-36"
            aria-label="Filter by priority"
            options={PRIORITY_FILTER_OPTIONS}
            value={params.priority ?? ""}
            onValueChange={(value) => setFilter("priority", value)}
          />

          <DateRangeFilter
            from={params.from}
            to={params.to}
            onChange={(range) => {
              setFilter("from", range.from ?? null)
              setFilter("to", range.to ?? null)
            }}
            className="w-full sm:w-auto"
          />
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          New enquiry
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle={params.search ? "No matching enquiries" : "No enquiries yet"}
        emptyDescription={
          params.search
            ? "Try a different customer name, code or destination."
            : "Log your first enquiry when the next call comes in."
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

      <LeadFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        lead={editing}
      />

      <ScheduleFollowupDialog
        open={Boolean(schedulingFor)}
        onOpenChange={(open) => !open && setSchedulingFor(null)}
        leadId={schedulingFor?.id ?? null}
        leadLabel={
          schedulingFor
            ? `${schedulingFor.customerName} · ${schedulingFor.code}`
            : undefined
        }
      />

      <TripFormDialog
        open={Boolean(convertingLead)}
        onOpenChange={(open) => !open && setConvertingLead(null)}
        fromLead={convertingLead}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete enquiry ${deleting?.code}?`}
        description="The enquiry is archived and disappears from the pipeline. Won enquiries linked to a trip cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
