"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  InboxIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  /** Stable key, also used as the sort key when `sortable` is set. */
  key: string
  header: React.ReactNode
  cell: (row: T, index: number) => React.ReactNode
  className?: string
  headerClassName?: string
  sortable?: boolean
  /** Hide below the md breakpoint to keep mobile tables readable. */
  hideOnMobile?: boolean
  /**
   * Money and counts read as "right", so the digits line up against a common
   * edge and magnitudes are comparable down the column.
   */
  align?: "left" | "right"
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[] | undefined
  getRowId: (row: T) => string
  isLoading?: boolean
  /** Shown when there are no rows and no error. */
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  onRowClick?: (row: T) => void
  /** Number of skeleton rows drawn while loading. Match the page size. */
  skeletonRows?: number
  pagination?: {
    page: number
    pageCount: number
    total: number
    pageSize: number
    onPageChange: (page: number) => void
  }
  sort?: {
    sortBy?: string
    sortDir: "asc" | "desc"
    onSortChange: (key: string) => void
  }
  className?: string
}

/**
 * The list surface shared by every module.
 *
 * Renders skeleton rows rather than swapping in a spinner, so the table keeps
 * its height between loads and the page never jumps while data streams in.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  onRowClick,
  skeletonRows = 8,
  pagination,
  sort,
  className,
}: DataTableProps<T>) {
  const showSkeleton = isLoading && !rows?.length
  const showEmpty = !isLoading && rows?.length === 0

  // One horizontal rhythm for every cell in every table, so columns line up
  // with the card edge instead of hugging it.
  const cellX = "px-4 first:pl-5 last:pr-5"

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {/* Plain sentence case on a plain background. Uppercase tracking
                  on a filled bar is the visual signature of a spreadsheet. */}
              <TableRow className="border-b hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "h-11 whitespace-nowrap text-[13px] font-normal text-muted-foreground",
                      cellX,
                      column.align === "right" && "text-right",
                      column.hideOnMobile && "hidden md:table-cell",
                      column.sortable &&
                        "cursor-pointer select-none transition-colors hover:text-foreground",
                      column.headerClassName
                    )}
                    onClick={
                      column.sortable && sort
                        ? () => sort.onSortChange(column.key)
                        : undefined
                    }
                    aria-sort={
                      sort?.sortBy === column.key
                        ? sort.sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        column.align === "right" && "flex-row-reverse"
                      )}
                    >
                      {column.header}
                      {column.sortable &&
                        (sort?.sortBy === column.key ? (
                          sort.sortDir === "asc" ? (
                            <ChevronUpIcon aria-hidden className="size-3.5 shrink-0" />
                          ) : (
                            <ChevronDownIcon aria-hidden className="size-3.5 shrink-0" />
                          )
                        ) : (
                          <ChevronsUpDownIcon
                            aria-hidden
                            className="size-3.5 shrink-0 opacity-30"
                          />
                        ))}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {showSkeleton &&
                Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "h-[4.5rem]",
                          cellX,
                          column.hideOnMobile && "hidden md:table-cell"
                        )}
                      >
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {showEmpty && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-72">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <InboxIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{emptyTitle}</p>
                        {emptyDescription && (
                          <p className="text-sm text-balance text-muted-foreground">
                            {emptyDescription}
                          </p>
                        )}
                      </div>
                      {emptyAction}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {rows?.map((row, index) => (
                <TableRow
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    // Dim stale rows while a background refetch is in flight.
                    isLoading && "opacity-60 transition-opacity"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      // A fixed row height keeps one- and two-line cells from
                      // making the table ripple as you scan down it.
                      className={cn(
                        "h-[4.5rem] py-2",
                        cellX,
                        column.align === "right" && "text-right",
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className
                      )}
                    >
                      {column.cell(row, index)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Inside the card, not floating under it — the count and the rows it
            describes stay visibly part of the same object. */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between gap-4 border-t px-5 py-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">
                {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{" "}
              of <span className="font-medium text-foreground">{pagination.total}</span>
            </p>

            {pagination.pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={pagination.page <= 1}
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="px-1 text-xs text-muted-foreground tabular-nums">
                  {pagination.page} / {pagination.pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={pagination.page >= pagination.pageCount}
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
