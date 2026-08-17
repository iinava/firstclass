import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"

/**
 * Ships a server-prefetched query cache to the client.
 *
 * This is what removes the loading flash on navigation: the Server Component
 * fetches the first page while rendering, dehydrates it here, and the client
 * `useQuery` with a matching key finds the data already present on mount.
 * Subsequent filtering and pagination then happen entirely client-side.
 */
export function Hydrate({
  client,
  children,
}: {
  client: QueryClient
  children: React.ReactNode
}) {
  return (
    <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>
  )
}
