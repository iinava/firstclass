"use client"

import * as React from "react"
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormProps,
} from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import type { QueryKey } from "@tanstack/react-query"
import type { ActionResult } from "@/lib/action"
import { useActionMutation } from "@/hooks/use-action-mutation"

/** Any Standard Schema the resolver accepts — in this codebase always Zod. */
type AnySchema = Parameters<typeof standardSchemaResolver>[0]

interface UseCrudFormOptions<TValues extends FieldValues, TOutput> {
  schema: AnySchema
  defaultValues: DefaultValues<TValues>
  /**
   * Receives the validated form values. Close over ids and other context here
   * rather than putting them in the form (see the edit dialogs for the shape).
   */
  action: (values: TValues) => Promise<ActionResult<TOutput>>
  successMessage?: string | ((data: TOutput, input: TValues) => string)
  invalidate?: QueryKey[]
  onSuccess?: (data: TOutput, input: TValues) => void | Promise<void>
  /** Reset back to defaultValues after a successful submit (create forms). */
  resetOnSuccess?: boolean
  formOptions?: Omit<UseFormProps<TValues>, "resolver" | "defaultValues">
}

/**
 * react-hook-form + zod + server action + sonner, wired once.
 *
 * The important bit is `fieldErrors` round-tripping: when the server rejects a
 * value the client schema allowed (a duplicate phone number, say), the error is
 * set on that specific input rather than only appearing in a toast.
 */
export function useCrudForm<TValues extends FieldValues, TOutput = unknown>({
  schema,
  defaultValues,
  action,
  successMessage,
  invalidate,
  onSuccess,
  resetOnSuccess = false,
  formOptions,
}: UseCrudFormOptions<TValues, TOutput>) {
  const form = useForm<TValues>({
    // The resolver is structurally correct but its generics can't be expressed
    // against an open TValues; the schema itself enforces the shape at runtime.
    resolver: standardSchemaResolver(schema) as unknown as Resolver<TValues>,
    defaultValues,
    mode: "onBlur",
    ...formOptions,
  })

  const mutation = useActionMutation<TValues, TOutput>({
    action,
    successMessage,
    invalidate,
    onSuccess: async (data, input) => {
      if (resetOnSuccess) form.reset(defaultValues)
      await onSuccess?.(data, input)
    },
    onError: (error) => {
      if (!error.fieldErrors) return
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        if (messages?.length) {
          form.setError(field as Path<TValues>, {
            type: "server",
            message: messages[0],
          })
        }
      }
    },
  })

  const { mutateAsync } = mutation

  const onSubmit = React.useMemo(
    () =>
      form.handleSubmit(async (values) => {
        // Errors are surfaced as toasts/field errors by useActionMutation;
        // swallowing here stops an unhandled rejection in the console.
        await mutateAsync(values as TValues).catch(() => {})
      }),
    [form, mutateAsync]
  )

  return {
    form,
    onSubmit,
    isPending: mutation.isPending,
    mutation,
  }
}
