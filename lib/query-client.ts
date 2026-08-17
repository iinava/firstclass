import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query"

/**
 * Shared QueryClient factory.
 *
 * `staleTime` above zero is essential with RSC prefetching: without it, every
 * query the server already resolved would be refetched the moment it hydrates
 * on the client, producing exactly the flash of loading state we are trying to
 * avoid on navigation.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry the user's own bad input or a permission failure.
          if (error instanceof Error && error.name === "ActionFailure") return false
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        // Include still-pending queries so streamed RSC prefetches reach the
        // client instead of being dropped mid-flight.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * On the server, always a fresh client so requests never share cache.
 * In the browser, one singleton so navigations reuse what's already loaded.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
