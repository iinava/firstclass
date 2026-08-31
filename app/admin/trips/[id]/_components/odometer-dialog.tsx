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
import { NumberField } from "@/components/shared/form-fields"
import { useCrudForm } from "@/hooks/use-crud-form"
import { qk } from "@/lib/query-keys"
import {
  UpdateAssignmentSchema,
  type UpdateAssignmentValues,
} from "@/validations/vehicle.validation"
import { updateAssignment } from "@/app/admin/fleet/actions"

/**
 * The end-odometer reading has to land somewhere before the fuel-cost
 * estimate on a trip's cost lines can ever compute — there was previously no
 * screen anywhere that let staff record it after the vehicle came back.
 */
export function OdometerDialog({
  open,
  onOpenChange,
  assignmentId,
  regNumber,
  driverId,
  startOdometer,
  endOdometer,
  notes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignmentId: string
  regNumber: string
  driverId: string | null
  startOdometer: number | null
  endOdometer: number | null
  notes: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && (
          <OdometerForm
            assignmentId={assignmentId}
            regNumber={regNumber}
            driverId={driverId}
            startOdometer={startOdometer}
            endOdometer={endOdometer}
            notes={notes}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OdometerForm({
  assignmentId,
  regNumber,
  driverId,
  startOdometer,
  endOdometer,
  notes,
  onDone,
  onCancel,
}: {
  assignmentId: string
  regNumber: string
  driverId: string | null
  startOdometer: number | null
  endOdometer: number | null
  notes: string | null
  onDone: () => void
  onCancel: () => void
}) {
  // Preserves the driver and notes already on the assignment — this dialog
  // only touches the odometer, and the update action applies every field it
  // receives, so leaving these out would silently clear them.
  const defaultValues = React.useMemo<UpdateAssignmentValues>(
    () => ({
      id: assignmentId,
      driverId,
      startOdometer,
      endOdometer,
      notes: notes ?? "",
    }),
    [assignmentId, driverId, startOdometer, endOdometer, notes]
  )

  const { form, onSubmit, isPending } = useCrudForm<UpdateAssignmentValues>({
    schema: UpdateAssignmentSchema,
    defaultValues: defaultValues as never,
    action: (values) => updateAssignment(values as never),
    successMessage: "Odometer updated",
    invalidate: [qk.vehicles.all, qk.bookings.all],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Odometer — {regNumber}</DialogTitle>
        <DialogDescription>
          The end reading drives the fuel-cost estimate on this trip's cost lines.
        </DialogDescription>
      </DialogHeader>

      <form id="odometer-form" onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              control={form.control}
              name="startOdometer"
              label="Start (km)"
              min={0}
            />
            <NumberField control={form.control} name="endOdometer" label="End (km)" min={0} />
          </div>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" form="odometer-form" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
