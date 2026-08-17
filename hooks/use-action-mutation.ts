"use client"

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/action"

/**
 * Client-side error carrying the field errors a server action reported, so a
 * form can map them back onto the offending inputs.
 */
export class ActionClientError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message)
    this.name = "ActionFailure"
  }
}

/** Unwrap an ActionResult into a resolved value or a thrown ActionClientError. */
export async function unwrapAction<T>(result: ActionResult<T>): Promise<T> {
  if (!result.ok) throw new ActionClientError(result.error, result.fieldErrors)
  return result.data
}

interface UseActionMutationOptions<TInput, TOutput> {
  action: (input: TInput) => Promise<ActionResult<TOutput>>
  /** Toast shown on success. Pass a function to build it from the result. */
  successMessage?: string | ((data: TOutput, input: TInput) => string)
  /** Query keys invalidated on success. */
  invalidate?: QueryKey[]
  onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>
  onError?: (error: ActionClientError, input: TInput) => void
  /** Set false to handle the error toast yourself. */
  showErrorToast?: boolean
}

/**
 * The single bridge between server actions and TanStack Query.
 *
 * Handles: unwrapping the ActionResult union, success/error toasts via sonner,
 * and cache invalidation — so no call site has to remember all three.
 */
export function useActionMutation<TInput = void, TOutput = unknown>({
  action,
  successMessage,
  invalidate = [],
  onSuccess,
  onError,
  showErrorToast = true,
}: UseActionMutationOptions<TInput, TOutput>) {
  const queryClient = useQueryClient()

  return useMutation<TOutput, ActionClientError, TInput>({
    mutationFn: async (input) => unwrapAction(await action(input)),
    onSuccess: async (data, input) => {
      await Promise.all(
        invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      if (successMessage) {
        toast.success(
          typeof successMessage === "function"
            ? successMessage(data, input)
            : successMessage
        )
      }
      await onSuccess?.(data, input)
    },
    onError: (error, input) => {
      if (showErrorToast) {
        toast.error(error.message, {
          // Surface the first field error as supporting detail — useful when
          // the dialog has scrolled past the offending input.
          description: error.fieldErrors
            ? Object.values(error.fieldErrors).flat()[0]
            : undefined,
        })
      }
      onError?.(error, input)
    },
  })
}
