"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from "lucide-react"
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

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap",
                      column.hideOnMobile && "hidden md:table-cell",
                      column.sortable && "cursor-pointer select-none",
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
                    <span className="inline-flex items-center gap-1">
                      {column.header}
                      {sort?.sortBy === column.key && (
                        <span aria-hidden className="text-muted-foreground text-xs">
                          {sort.sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
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
                        className={cn(column.hideOnMobile && "hidden md:table-cell")}
                      >
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {showEmpty && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-64">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                        <InboxIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{emptyTitle}</p>
                        {emptyDescription && (
                          <p className="mt-1 text-sm text-muted-foreground">
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
                      className={cn(
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
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{" "}
            of <span className="font-medium text-foreground">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pagination.page} / {pagination.pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pageCount}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
