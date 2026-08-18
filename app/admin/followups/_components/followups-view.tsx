"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  MessageCircleIcon,
  PhoneIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { useDebouncedValue, useListParams } from "@/hooks/use-list-params"
import { formatDateTime, formatPhone, formatRelativeDay } from "@/lib/format"
import { qk } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { FOLLOWUP_CHANNEL_LABELS } from "@/validations/lead.validation"
import type { FollowupRow } from "@/lib/services/followup.service"
import {
  deleteFollowup,
  fetchFollowupCounts,
  fetchFollowups,
} from "@/app/admin/leads/actions"
import { CompleteFollowupDialog } from "./complete-followup-dialog"

const BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
] as const

const PAGE_SIZE = 25

export function FollowupsView() {
  const { params, setSearch, setFilter, setPage } = useListParams<{
    bucket: string
  }>(["bucket"])

  const bucket = params.bucket || "today"

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
      bucket: bucket as never,
      search: params.search || undefined,
      sortBy: "dueAt",
      sortDir: "asc" as const,
    }),
    [params.page, params.search, bucket]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.followups.queue(queryParams),
    queryFn: async () => unwrapAction(await fetchFollowups(queryParams)),
    placeholderData: (previous) => previous,
  })

  const { data: counts } = useQuery({
    queryKey: qk.followups.counts(),
    queryFn: async () => unwrapAction(await fetchFollowupCounts()),
  })

  const [completing, setCompleting] = React.useState<FollowupRow | null>(null)
  const [deleting, setDeleting] = React.useState<FollowupRow | null>(null)

  const removeMutation = useActionMutation({
    action: deleteFollowup,
    successMessage: "Follow-up removed",
    invalidate: [qk.followups.all, qk.leads.all],
    onSuccess: () => setDeleting(null),
  })

  const columns = React.useMemo<DataTableColumn<FollowupRow>[]>(
    () => [
      {
        key: "dueAt",
        header: "Due",
        cell: (row) => {
          const overdue = new Date(row.dueAt) < new Date()
          return (
            <div className="min-w-0">
              <p
                className={cn(
                  "font-medium",
                  overdue && row.status === "pending" && "text-red-500"
                )}
              >
                {formatRelativeDay(row.dueAt)}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {formatDateTime(row.dueAt)}
              </p>
            </div>
          )
        },
      },
      {
        key: "customer",
        header: "Customer",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{row.customerName}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {row.leadCode}
              {row.destination ? ` · ${row.destination}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "phone",
        header: "Contact",
        hideOnMobile: true,
        cell: (row) => (
          <div className="flex items-center gap-2">
            <a
              href={`tel:${row.customerPhone}`}
              className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <PhoneIcon className="size-3 text-muted-foreground" />
              {formatPhone(row.customerPhone)}
            </a>
            <a
              href={`https://wa.me/91${row.customerPhone.replace(/\D/g, "").slice(-10)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              onClick={(event) => event.stopPropagation()}
              aria-label="Open WhatsApp chat"
            >
              <MessageCircleIcon className="size-3.5" />
            </a>
          </div>
        ),
      },
      {
        key: "note",
        header: "What to do",
        hideOnMobile: true,
        cell: (row) => (
          <p className="max-w-xs truncate text-muted-foreground">
            {row.note ?? `${FOLLOWUP_CHANNEL_LABELS[row.channel]} — no note`}
          </p>
        ),
      },
      {
        key: "leadStatus",
        header: "Stage",
        hideOnMobile: true,
        cell: (row) => <StatusBadge status={row.leadStatus} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        className: "w-32",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            {row.status === "pending" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation()
                  setCompleting(row)
                }}
              >
                <CheckIcon data-icon="inline-start" />
                Done
              </Button>
            ) : (
              <StatusBadge status={row.status} />
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete follow-up"
              onClick={(event) => {
                event.stopPropagation()
                setDeleting(row)
              }}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const countFor = (key: string) =>
    counts ? (counts as Record<string, number>)[key] ?? 0 : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {BUCKETS.map((item) => {
            const active = bucket === item.key
            const badge = countFor(item.key)
            return (
              <Button
                key={item.key}
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setFilter("bucket", item.key)}
              >
                {item.label}
                {badge !== undefined && badge > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-muted",
                      item.key === "overdue" && !active && "bg-red-500/15 text-red-500"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupInput
            placeholder="Search customer or code…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search follow-ups"
          />
          <InputGroupAddon>
            <SearchIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle={
          bucket === "overdue"
            ? "Nothing overdue"
            : bucket === "today"
              ? "You're all caught up"
              : "No follow-ups here"
        }
        emptyDescription={
          bucket === "today"
            ? "No calls or messages due today. Schedule the next action from any enquiry."
            : "Follow-ups you schedule against enquiries will appear here."
        }
        onRowClick={(row) => row.status === "pending" && setCompleting(row)}
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

      <CompleteFollowupDialog
        open={Boolean(completing)}
        onOpenChange={(open) => !open && setCompleting(null)}
        followup={completing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this follow-up?"
        description="It will be deleted permanently. The lead and its history are unaffected."
        confirmLabel="Remove"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
