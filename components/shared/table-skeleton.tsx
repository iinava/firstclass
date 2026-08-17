import { Skeleton } from "@/components/ui/skeleton"

/**
 * Generic toolbar + table placeholder, sized to match the real layout so the
 * Suspense swap doesn't shift the page.
 */
export function TableSkeleton({
  rows = 8,
  withTiles = false,
}: {
  rows?: number
  withTiles?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {withTiles && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-xl border bg-card">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="ml-auto h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
