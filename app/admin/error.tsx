"use client"

import * as React from "react"
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Catches render-time failures inside /admin, including the AuthorizationError
 * thrown by `requirePermission` when someone reaches a page their role can't see.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[admin] route error", error)
  }, [error])

  const isForbidden =
    error.name === "AuthorizationError" ||
    error.message.toLowerCase().includes("permission")

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangleIcon className="size-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {isForbidden ? "You don't have access to this page" : "Something went wrong"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isForbidden
              ? "Ask an administrator if you need this permission added to your role."
              : "The page failed to load. Try again, and if it keeps happening send this reference to your developer."}
          </p>
          {error.digest && !isForbidden && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {error.digest}
            </p>
          )}
        </div>
        {!isForbidden && (
          <Button onClick={reset}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
