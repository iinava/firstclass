"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import * as service from "@/lib/services/vehicle.service"
import { uuidSchema } from "@/validations/common.validation"
import {
  AssignVehicleSchema,
  CreateDriverSchema,
  CreateVehicleSchema,
  DeleteAssignmentSchema,
  DeleteDriverSchema,
  DeleteVehicleSchema,
  UpdateAssignmentSchema,
  UpdateDriverSchema,
  UpdateVehicleSchema,
  VehicleListParamsSchema,
} from "@/validations/vehicle.validation"

export const fetchVehicles = defineAction({
  name: "fetchVehicles",
  permission: "vehicle:view",
  schema: VehicleListParamsSchema,
  handler: async (params) => service.listVehicles(params),
})

export const fetchVehicleOptions = defineAction({
  name: "fetchVehicleOptions",
  permission: "vehicle:view",
  handler: async (_input: void) => service.getVehicleOptions(),
})

export const fetchDrivers = defineAction({
  name: "fetchDrivers",
  permission: "vehicle:view",
  schema: z.object({ search: z.string().optional() }),
  handler: async ({ search }) => service.listDrivers(search),
})

export const createVehicle = defineAction({
  name: "createVehicle",
  permission: "vehicle:create",
  schema: CreateVehicleSchema,
  handler: async (input, { session }) => {
    const vehicle = await service.createVehicle({
      ...input,
      supplierId: input.supplierId ?? null,
      defaultDriverId: input.defaultDriverId ?? null,
      createdBy: session.userId,
    })
    await recordAudit({
      entity: "vehicles",
      entityId: vehicle.id,
      action: "create",
      summary: `Added vehicle ${vehicle.regNumber}`,
      session,
    })
    revalidatePath("/admin/fleet")
    return vehicle
  },
})

export const updateVehicle = defineAction({
  name: "updateVehicle",
  permission: "vehicle:update",
  schema: UpdateVehicleSchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await service.getVehicle(id)
    if (!before) throw new ActionFailure("Vehicle not found")

    const vehicle = await service.updateVehicle(id, {
      ...values,
      supplierId: values.supplierId ?? null,
      defaultDriverId: values.defaultDriverId ?? null,
    })
    if (!vehicle) throw new ActionFailure("Vehicle not found")

    await recordAudit({
      entity: "vehicles",
      entityId: id,
      action: "update",
      summary: `Updated vehicle ${vehicle.regNumber}`,
      changes: diffChanges(before, vehicle),
      session,
    })
    revalidatePath("/admin/fleet")
    return vehicle
  },
})

export const deleteVehicle = defineAction({
  name: "deleteVehicle",
  permission: "vehicle:delete",
  schema: DeleteVehicleSchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getVehicle(id)
    if (!before) throw new ActionFailure("Vehicle not found")

    const result = await service.softDeleteVehicle(id)
    if (!result.ok) throw new ActionFailure(result.reason)

    await recordAudit({
      entity: "vehicles",
      entityId: id,
      action: "delete",
      summary: `Deleted vehicle ${before.regNumber}`,
      session,
    })
    revalidatePath("/admin/fleet")
    return { id }
  },
})

// ------------------------------------------------------------------- drivers

export const createDriver = defineAction({
  name: "createDriver",
  permission: "vehicle:create",
  schema: CreateDriverSchema,
  handler: async (input, { session }) => {
    const driver = await service.createDriver(input)
    await recordAudit({
      entity: "drivers",
      entityId: driver.id,
      action: "create",
      summary: `Added driver ${driver.name}`,
      session,
    })
    revalidatePath("/admin/fleet")
    return driver
  },
})

export const updateDriver = defineAction({
  name: "updateDriver",
  permission: "vehicle:update",
  schema: UpdateDriverSchema,
  handler: async ({ id, ...values }) => {
    const driver = await service.updateDriver(id, values)
    if (!driver) throw new ActionFailure("Driver not found")
    revalidatePath("/admin/fleet")
    return driver
  },
})

export const deleteDriver = defineAction({
  name: "deleteDriver",
  permission: "vehicle:delete",
  schema: DeleteDriverSchema,
  handler: async ({ id }) => {
    const result = await service.softDeleteDriver(id)
    if (!result.ok) throw new ActionFailure(result.reason)
    revalidatePath("/admin/fleet")
    return { id }
  },
})

// --------------------------------------------------------------- assignments

export const fetchAssignments = defineAction({
  name: "fetchAssignments",
  permission: "booking:view",
  schema: z.object({ bookingId: uuidSchema }),
  handler: async ({ bookingId }) => service.listAssignmentsByBooking(bookingId),
})

/**
 * Blocks a vehicle for a trip. Refuses when the dates overlap an existing
 * assignment — promising one vehicle to two trips is the single most expensive
 * scheduling mistake this business can make.
 */
export const assignVehicle = defineAction({
  name: "assignVehicle",
  permission: "vehicle:update",
  schema: AssignVehicleSchema,
  handler: async (input, { session }) => {
    const result = await service.assignVehicleAtomic({
      ...input,
      driverId: input.driverId ?? null,
      startOdometer: input.startOdometer ?? null,
      createdBy: session.userId,
    })
    if (!result.ok) {
      const { conflict } = result
      throw new ActionFailure(
        `This vehicle is already assigned to ${conflict.bookingCode} from ${conflict.startDate} to ${conflict.endDate}`,
        { vehicleId: ["Vehicle is not available for these dates"] }
      )
    }
    const { assignment } = result

    await recordAudit({
      entity: "vehicle_assignments",
      entityId: assignment.id,
      action: "create",
      summary: "Assigned vehicle to trip",
      session,
    })

    revalidatePath(`/admin/trips/${input.bookingId}`)
    return assignment
  },
})

export const updateAssignment = defineAction({
  name: "updateAssignment",
  permission: "vehicle:update",
  schema: UpdateAssignmentSchema,
  handler: async ({ id, ...values }) => {
    const assignment = await service.updateAssignment(id, {
      ...values,
      driverId: values.driverId ?? null,
      startOdometer: values.startOdometer ?? null,
      endOdometer: values.endOdometer ?? null,
    })
    if (!assignment) throw new ActionFailure("Assignment not found")
    revalidatePath(`/admin/trips/${assignment.bookingId}`)
    return assignment
  },
})

export const removeAssignment = defineAction({
  name: "removeAssignment",
  permission: "vehicle:update",
  schema: DeleteAssignmentSchema,
  handler: async ({ id }) => {
    const assignment = await service.deleteAssignment(id)
    if (assignment) revalidatePath(`/admin/trips/${assignment.bookingId}`)
    return { id }
  },
})
