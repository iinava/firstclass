"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OptionSelect, optionsFrom } from "@/components/shared/option-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  CreateFollowupSchema,
  FOLLOWUP_CHANNELS,
  FOLLOWUP_CHANNEL_LABELS,
  type CreateFollowupValues,
} from "@/validations/lead.validation"
import { createFollowup } from "@/app/admin/leads/actions"

interface ScheduleFollowupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string | null
  leadLabel?: string
}

const CHANNEL_OPTIONS = optionsFrom(FOLLOWUP_CHANNELS, FOLLOWUP_CHANNEL_LABELS)

/** Tomorrow at 10am — the default a salesperson would pick nine times out of ten. */
function defaultDueAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ScheduleFollowupDialog({
  open,
  onOpenChange,
  leadId,
  leadLabel,
}: ScheduleFollowupDialogProps) {
  const defaultValues = React.useMemo<CreateFollowupValues>(
    () => ({
      leadId: leadId ?? "",
      dueAt: defaultDueAt(),
      channel: "call",
      note: "",
      assignedTo: null,
    }),
    [leadId]
  )

  const { form, onSubmit, isPending } = useCrudForm<CreateFollowupValues>({
    schema: CreateFollowupSchema,
    defaultValues: defaultValues as never,
    action: (values) => createFollowup({ ...values, leadId: leadId! } as never),
    successMessage: "Follow-up scheduled",
    invalidate: [qk.followups.all, qk.leads.all],
    onSuccess: () => onOpenChange(false),
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues as never)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId])

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>
            {leadLabel ?? "Set the next action so this enquiry doesn't go cold."}
          </DialogDescription>
        </DialogHeader>

        <form id="schedule-followup-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              name="dueAt"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="followup-due">When</FieldLabel>
                  <Input
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="followup-due"
                    type="datetime-local"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="channel"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="followup-channel">How</FieldLabel>
                  <OptionSelect
                    id="followup-channel"
                    className="w-full"
                    name={field.name}
                    options={CHANNEL_OPTIONS}
                    value={(field.value as string) ?? "call"}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Field>
              )}
            />

            <Controller
              name="note"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="followup-note">What to do</FieldLabel>
                  <Textarea
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="followup-note"
                    rows={3}
                    placeholder="Send the revised Munnar quote with the Ooty extension"
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="schedule-followup-form" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
