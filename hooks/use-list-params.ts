"use client"

import * as React from "react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

/**
 * List state (search, page, sort, filters) lives in the URL rather than in
 * component state, so a filtered view is shareable, survives a refresh, and
 * the browser's back button steps through filter changes as users expect.
 *
 * `history: "replace"` keeps typing in the search box from flooding history.
 */
export function useListParams<TFilters extends Record<string, string>>(
  filterKeys: (keyof TFilters & string)[] = [],
  /**
   * Must match the default the page's server-side prefetch uses — the query key
   * includes sortBy, so a mismatch silently refetches instead of hydrating.
   */
  defaultSortBy = "createdAt"
) {
  // filterKeys is a literal array at every call site, so its joined form is a
  // stable identity to memoise against.
  const filterKeyId = filterKeys.join(",")

  const filterParsers = React.useMemo(
    () =>
      Object.fromEntries(
        filterKeyId
          .split(",")
          .filter(Boolean)
          .map((key) => [key, parseAsString.withDefault("")])
      ),
    [filterKeyId]
  )

  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      search: parseAsString.withDefault(""),
      sortBy: parseAsString.withDefault(defaultSortBy),
      sortDir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
      ...filterParsers,
    },
    { history: "replace", shallow: true }
  )

  /** Any filter change resets to page 1 — otherwise you land on an empty page. */
  const setFilter = React.useCallback(
    (key: string, value: string | null) => {
      setParams({ [key]: value || null, page: 1 })
    },
    [setParams]
  )

  const setSearch = React.useCallback(
    (value: string) => setParams({ search: value || null, page: 1 }),
    [setParams]
  )

  const setPage = React.useCallback(
    (page: number) => setParams({ page }),
    [setParams]
  )

  /** Click a column: same column toggles direction, new column starts desc. */
  const setSort = React.useCallback(
    (key: string) => {
      setParams((prev) => ({
        sortBy: key,
        sortDir: prev.sortBy === key && prev.sortDir === "desc" ? "asc" : "desc",
        page: 1,
      }))
    },
    [setParams]
  )

  const reset = React.useCallback(() => {
    setParams({
      page: null,
      search: null,
      sortBy: null,
      sortDir: null,
      ...Object.fromEntries(
        filterKeyId.split(",").filter(Boolean).map((key) => [key, null])
      ),
    })
  }, [setParams, filterKeyId])

  const activeFilterCount = filterKeys.filter(
    (key) => (params as Record<string, unknown>)[key]
  ).length

  return {
    params: params as typeof params & TFilters,
    setParams,
    setFilter,
    setSearch,
    setPage,
    setSort,
    reset,
    activeFilterCount,
  }
}

/**
 * Debounces the search term so a query fires once the user pauses, not on
 * every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
