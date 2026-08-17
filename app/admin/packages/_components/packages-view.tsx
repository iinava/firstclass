"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  LayoutGridIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { formatDuration } from "@/lib/format"
import { formatMoneyShort } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  ITINERARY_STATUSES,
  ITINERARY_STATUS_LABELS,
} from "@/validations/itinerary.validation"
import type { ItineraryListRow } from "@/lib/services/itinerary.service"
import {
  cloneItinerary,
  deleteItinerary,
  fetchItineraries,
  updateItineraryStatus,
} from "../actions"
import { ItineraryFormDialog } from "./itinerary-form-dialog"

const PAGE_SIZE = 25

const KIND_FILTER_OPTIONS = [
  { value: "", label: "All types" },
  { value: "package", label: "Packages" },
  { value: "custom", label: "Quotes" },
]

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...optionsFrom(ITINERARY_STATUSES, ITINERARY_STATUS_LABELS),
]

export function PackagesView() {
  const { params, setSearch, setFilter, setPage } = useListParams<{
    kind: string
    status: string
  }>(["kind", "status"])

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
      kind: (params.kind || undefined) as never,
      status: (params.status || undefined) as never,
    }),
    [params.page, params.search, params.sortDir, params.kind, params.status]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.itineraries.list(queryParams),
    queryFn: async () => unwrapAction(await fetchItineraries(queryParams)),
    placeholderData: (previous) => previous,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ItineraryListRow | null>(null)
  const [deleting, setDeleting] = React.useState<ItineraryListRow | null>(null)

  const statusMutation = useActionMutation({
    action: updateItineraryStatus,
    successMessage: "Status updated",
    invalidate: [qk.itineraries.all],
  })

  const cloneMutation = useActionMutation({
    action: cloneItinerary,
    successMessage: "Quote created from package",
    invalidate: [qk.itineraries.all],
  })

  const removeMutation = useActionMutation({
    action: deleteItinerary,
    successMessage: "Itinerary deleted",
    invalidate: [qk.itineraries.all],
    onSuccess: () => setDeleting(null),
  })

  const copyShareLink = async (row: ItineraryListRow) => {
    const url = `${window.location.origin}/i/${row.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Share link copied", { description: url })
    } catch {
      // Clipboard access is blocked in some browsers/contexts — show the URL so
      // it can still be copied by hand.
      toast.info("Copy this link", { description: url, duration: 10000 })
    }
  }

  const columns = React.useMemo<DataTableColumn<ItineraryListRow>[]>(
    () => [
      {
        key: "title",
        header: "Itinerary",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.code}
              {row.destination ? ` · ${row.destination}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "kind",
        header: "Type",
        cell: (row) => (
          <StatusBadge
            status={row.kind}
            label={row.kind === "package" ? "Package" : "Quote"}
            tone={row.kind === "package" ? "accent" : "info"}
          />
        ),
      },
      {
        key: "duration",
        header: "Duration",
        hideOnMobile: true,
        cell: (row) => (
          <span className="whitespace-nowrap">
            {formatDuration(row.durationDays, row.durationNights)}
          </span>
        ),
      },
      {
        key: "days",
        header: "Content",
        hideOnMobile: true,
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.dayCount} day{row.dayCount === 1 ? "" : "s"} · {row.imageCount} photo
            {row.imageCount === 1 ? "" : "s"}
          </span>
        ),
      },
      {
        key: "price",
        header: "Price",
        hideOnMobile: true,
        cell: (row) => {
          const price =
            row.pricingMode === "per_pax" ? row.pricePerAdult : row.fixedPrice
          return price ? (
            <span className="tabular-nums">
              {formatMoneyShort(price)}
              {row.pricingMode === "per_pax" && (
                <span className="text-xs text-muted-foreground">/pax</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        key: "views",
        header: "Views",
        hideOnMobile: true,
        cell: (row) => (
          <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
            <EyeIcon className="size-3.5" />
            {row.viewCount}
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem render={<Link href={`/admin/packages/${row.id}`} />}>
                <PencilIcon className="size-4" />
                Edit days & photos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <PencilIcon className="size-4" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyShareLink(row)}>
                <LinkIcon className="size-4" />
                Copy share link
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a
                    href={`/i/${row.shareToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLinkIcon className="size-4" />
                Preview shared page
              </DropdownMenuItem>

              {row.kind === "package" && (
                <DropdownMenuItem
                  disabled={cloneMutation.isPending}
                  onClick={() => cloneMutation.mutate({ sourceId: row.id } as never)}
                >
                  <CopyIcon className="size-4" />
                  Create quote from this
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              {/* The label is a group part — outside DropdownMenuGroup Base UI
                  throws and the whole page falls into the error boundary. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Set status
                </DropdownMenuLabel>
                {ITINERARY_STATUSES.filter((status) => status !== row.status).map(
                  (status) => (
                    <DropdownMenuItem
                      key={status}
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({ id: row.id, status } as never)
                      }
                    >
                      {ITINERARY_STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [statusMutation, cloneMutation]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupInput
              placeholder="Search title, code, destination…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search itineraries"
            />
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>

          <OptionSelect
            className="w-full sm:w-36"
            aria-label="Filter by type"
            options={KIND_FILTER_OPTIONS}
            value={params.kind ?? ""}
            onValueChange={(value) => setFilter("kind", value)}
          />

          <OptionSelect
            className="w-full sm:w-36"
            aria-label="Filter by status"
            options={STATUS_FILTER_OPTIONS}
            value={params.status ?? ""}
            onValueChange={(value) => setFilter("status", value)}
          />
        </div>

        <Button
          variant="outline"
          render={
            <a href="/packages" target="_blank" rel="noopener noreferrer" />
          }
        >
          <LayoutGridIcon data-icon="inline-start" />
          Customer catalogue
        </Button>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          New itinerary
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        getRowId={(row) => row.id}
        isLoading={isLoading || isFetching}
        emptyTitle="No itineraries yet"
        emptyDescription="Build a reusable package once, then clone it into quotes for each customer."
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

      <ItineraryFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        itinerary={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title}?`}
        description="The itinerary is archived and its share link stops working."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
