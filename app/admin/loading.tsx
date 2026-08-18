import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shown only for the brief moment a route segment's code is still loading.
 * Data-dependent regions have their own Suspense boundaries inside each page,
 * so this rarely appears — but without it a slow chunk would block navigation.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
