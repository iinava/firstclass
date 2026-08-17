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
import {
  SelectField,
  SwitchField,
  TextField,
} from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { ROLE_LABELS } from "@/lib/rbac"
import { qk } from "@/lib/query-keys"
import {
  CreateUserSchema,
  USER_ROLES,
  UserFormSchema,
  type UserFormValues,
} from "@/validations/user.validation"
import type { UserListRow } from "@/lib/services/user.service"
import { createUser, updateUser } from "../actions"

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

const EMPTY: UserFormValues = {
  username: "",
  password: "",
  name: "",
  email: "",
  phone: "",
  role: "staff",
  isActive: true,
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  isSelf,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserListRow | null
  isSelf?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {open && (
          <UserForm
            key={user?.id ?? "new"}
            user={user ?? null}
            isSelf={Boolean(isSelf)}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function UserForm({
  user,
  isSelf,
  onDone,
  onCancel,
}: {
  user: UserListRow | null
  isSelf: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(user)

  const defaultValues = React.useMemo<UserFormValues>(
    () =>
      user
        ? {
            username: user.username,
            password: "",
            name: user.name ?? "",
            email: user.email ?? "",
            phone: user.phone ?? "",
            role: user.role,
            isActive: user.isActive,
          }
        : EMPTY,
    [user]
  )

  const { form, onSubmit, isPending } = useCrudForm<UserFormValues>({
    // Creating requires a password; editing never touches it (see Reset password).
    schema: isEdit ? UserFormSchema : CreateUserSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      user
        ? updateUser({
            id: user.id,
            name: values.name,
            email: values.email,
            phone: values.phone,
            role: values.role,
            isActive: values.isActive,
          } as never)
        : createUser(values as never),
    successMessage: isEdit ? "Account updated" : "Account created",
    invalidate: [qk.users.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit account" : "New account"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Change details and role. Use “Reset password” to set a new password."
            : "The person signs in with this username and password."}
        </DialogDescription>
      </DialogHeader>

      <form id="user-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <TextField
            control={form.control}
            name="username"
            label="Username"
            placeholder="anitha"
            disabled={isEdit}
            description={isEdit ? undefined : "Lowercase letters, numbers, . _ -"}
            autoFocus={!isEdit}
          />

          {!isEdit && (
            <TextField
              control={form.control}
              name="password"
              label="Password"
              type="password"
              description="At least 8 characters, with a letter and a number."
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Full name" />
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
            />
          </div>

          <TextField control={form.control} name="email" label="Email" type="email" />

          <SelectField
            control={form.control}
            name="role"
            label="Role"
            options={ROLE_OPTIONS}
            disabled={isSelf}
            description={
              isSelf
                ? "You cannot change your own role."
                : "Determines which screens and actions are available."
            }
          />

          <SwitchField
            control={form.control}
            name="isActive"
            label="Active"
            description={
              isSelf
                ? "You cannot deactivate your own account."
                : "Inactive accounts cannot sign in."
            }
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="user-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {isEdit ? "Save changes" : "Create account"}
        </Button>
      </DialogFooter>
    </>
  )
}
