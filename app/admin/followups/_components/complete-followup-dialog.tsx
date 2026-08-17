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
  CompleteFollowupSchema,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type CompleteFollowupValues,
} from "@/validations/lead.validation"
import { completeFollowup } from "@/app/admin/leads/actions"
import type { FollowupRow } from "@/lib/services/followup.service"

interface CompleteFollowupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  followup: FollowupRow | null
}

function inThreeDays(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  date.setHours(10, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Logging the outcome, moving the lead stage, and booking the next call are one
 * decision in the salesperson's head — so they are one dialog here, not three.
 */
export function CompleteFollowupDialog({
  open,
  onOpenChange,
  followup,
}: CompleteFollowupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Mounted only while open and keyed per follow-up, so form state and
            the "schedule next" toggle reset naturally instead of via effects. */}
        {open && followup && (
          <CompleteFollowupForm
            key={followup.id}
            followup={followup}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CompleteFollowupForm({
  followup,
  onDone,
  onCancel,
}: {
  followup: FollowupRow
  onDone: () => void
  onCancel: () => void
}) {
  const [scheduleNext, setScheduleNext] = React.useState(true)

  // The empty option keeps the lead where it is, so it names the current stage.
  const nextStatusOptions = React.useMemo(
    () => [
      {
        value: "",
        label: `Leave as ${LEAD_STATUS_LABELS[followup.leadStatus as never]}`,
      },
      ...optionsFrom(LEAD_STATUSES, LEAD_STATUS_LABELS),
    ],
    [followup.leadStatus]
  )

  const defaultValues = React.useMemo<CompleteFollowupValues>(
    () => ({
      id: followup.id,
      outcome: "",
      nextDueAt: inThreeDays(),
      nextNote: "",
      nextStatus: null,
    }),
    [followup.id]
  )

  const { form, onSubmit, isPending } = useCrudForm<CompleteFollowupValues>({
    schema: CompleteFollowupSchema,
    defaultValues: defaultValues as never,
    action: (values) =>
      completeFollowup({
        ...values,
        id: followup.id,
        // Drop the next follow-up entirely when the toggle is off.
        nextDueAt: scheduleNext ? values.nextDueAt : null,
        nextNote: scheduleNext ? values.nextNote : null,
      } as never),
    successMessage: (result) =>
      (result as { next: unknown })?.next
        ? "Follow-up completed, next one scheduled"
        : "Follow-up completed",
    invalidate: [qk.followups.all, qk.leads.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Log follow-up</DialogTitle>
        <DialogDescription>
          {`${followup.customerName} · ${followup.leadCode}`}
        </DialogDescription>
      </DialogHeader>

        <form id="complete-followup-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              name="outcome"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="followup-outcome">What happened?</FieldLabel>
                  <Textarea
                    {...field}
                    value={(field.value as string) ?? ""}
                    id="followup-outcome"
                    rows={3}
                    autoFocus
                    placeholder="Spoke to customer — wants to add 2 nights in Thekkady, sending revised quote"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="nextStatus"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="followup-next-status">
                    Move enquiry to
                  </FieldLabel>
                  <OptionSelect
                    id="followup-next-status"
                    className="w-full"
                    name={field.name}
                    options={nextStatusOptions}
                    value={(field.value as string) ?? ""}
                    onValueChange={(value) => field.onChange(value || null)}
                    onBlur={field.onBlur}
                  />
                </Field>
              )}
            />

            <div className="rounded-lg border border-dashed p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(event) => setScheduleNext(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Schedule the next follow-up
              </label>

              {scheduleNext && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="nextDueAt"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="followup-next-due">When</FieldLabel>
                        <Input
                          {...field}
                          value={(field.value as string) ?? ""}
                          id="followup-next-due"
                          type="datetime-local"
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="nextNote"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="followup-next-note">Note</FieldLabel>
                        <Input
                          {...field}
                          value={(field.value as string) ?? ""}
                          id="followup-next-note"
                          placeholder="Check if quote was reviewed"
                        />
                      </Field>
                    )}
                  />
                </div>
              )}
            </div>
          </FieldGroup>
        </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="complete-followup-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Mark done
        </Button>
      </DialogFooter>
    </>
  )
}
