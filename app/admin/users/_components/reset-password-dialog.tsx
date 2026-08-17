"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { TextField } from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import { ResetPasswordSchema } from "@/validations/user.validation"
import type { UserListRow } from "@/lib/services/user.service"
import { resetPassword } from "../actions"

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserListRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && user && (
          <ResetForm
            key={user.id}
            user={user}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResetForm({
  user,
  onDone,
  onCancel,
}: {
  user: UserListRow
  onDone: () => void
  onCancel: () => void
}) {
  const { form, onSubmit, isPending } = useCrudForm<{ id: string; password: string }>({
    schema: ResetPasswordSchema,
    defaultValues: { id: user.id, password: "" } as never,
    action: (values) => resetPassword({ ...values, id: user.id } as never),
    successMessage: `Password reset for ${user.username}`,
    invalidate: [qk.users.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>
          Sets a new password for <span className="font-medium">{user.username}</span>.
          Share it with them directly — it is never shown again.
        </DialogDescription>
      </DialogHeader>

      <form id="reset-password-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <TextField
            control={form.control}
            name="password"
            label="New password"
            type="password"
            autoFocus
            description="At least 8 characters, with a letter and a number."
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="reset-password-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Reset password
        </Button>
      </DialogFooter>
    </>
  )
}
