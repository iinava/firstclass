"use server"

import { revalidatePath } from "next/cache"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { z } from "zod"
import { ActionFailure, AuthorizationError, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { nextEmployeeCode } from "@/lib/codes"
import { hasPermission } from "@/lib/rbac"
import * as service from "@/lib/services/hrms.service"
import {
  AttendanceListParamsSchema,
  BulkAttendanceSchema,
  CreateEmployeeSchema,
  DecideLeaveSchema,
  DeleteEmployeeSchema,
  EmployeeListParamsSchema,
  LeaveListParamsSchema,
  LeaveRequestSchema,
  MarkAttendanceSchema,
  UpdateEmployeeSchema,
} from "@/validations/hrms.validation"

export const fetchEmployees = defineAction({
  name: "fetchEmployees",
  permission: "hrms:view",
  schema: EmployeeListParamsSchema,
  handler: async (params) => service.listEmployees(params),
})

export const fetchLinkableUsers = defineAction({
  name: "fetchLinkableUsers",
  permission: "hrms:view",
  handler: async (_input: void) => service.getUnlinkedUsers(),
})

export const createEmployee = defineAction({
  name: "createEmployee",
  permission: "hrms:manage",
  schema: CreateEmployeeSchema,
  handler: async (input, { session }) => {
    const empCode = await nextEmployeeCode()
    const employee = await service.createEmployee({
      ...input,
      empCode,
      userId: input.userId ?? null,
      createdBy: session.userId,
    })

    await recordAudit({
      entity: "employees",
      entityId: employee.id,
      action: "create",
      summary: `Added employee ${employee.name} (${empCode})`,
      session,
    })

    revalidatePath("/admin/employees")
    return employee
  },
})

export const updateEmployee = defineAction({
  name: "updateEmployee",
  permission: "hrms:manage",
  schema: UpdateEmployeeSchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await service.getEmployee(id)
    if (!before) throw new ActionFailure("Employee not found")

    const employee = await service.updateEmployee(id, {
      ...values,
      userId: values.userId ?? null,
    })
    if (!employee) throw new ActionFailure("Employee not found")

    await recordAudit({
      entity: "employees",
      entityId: id,
      action: "update",
      summary: `Updated employee ${employee.name}`,
      changes: diffChanges(before, employee),
      session,
    })

    revalidatePath("/admin/employees")
    return employee
  },
})

export const deleteEmployee = defineAction({
  name: "deleteEmployee",
  permission: "hrms:manage",
  schema: DeleteEmployeeSchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getEmployee(id)
    if (!before) throw new ActionFailure("Employee not found")

    await service.softDeleteEmployee(id)
    await recordAudit({
      entity: "employees",
      entityId: id,
      action: "delete",
      summary: `Removed employee ${before.name}`,
      session,
    })
    revalidatePath("/admin/employees")
    return { id }
  },
})

// ---------------------------------------------------------------- attendance

export const fetchAttendance = defineAction({
  name: "fetchAttendance",
  permission: "hrms:view",
  schema: AttendanceListParamsSchema,
  handler: async ({ date }) =>
    service.getAttendanceForDate(date ?? new Date().toISOString().slice(0, 10)),
})

export const fetchAttendanceSummary = defineAction({
  name: "fetchAttendanceSummary",
  permission: "hrms:view",
  schema: AttendanceListParamsSchema,
  handler: async (params) => service.getAttendanceSummary(params),
})

/** Minutes worked, so the monthly summary never has to re-parse times. */
function workedMinutes(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return null
  const [inH, inM] = checkIn.split(":").map(Number)
  const [outH, outM] = checkOut.split(":").map(Number)
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return null
  const minutes = outH * 60 + outM - (inH * 60 + inM)
  return minutes > 0 ? minutes : null
}

export const markAttendance = defineAction({
  name: "markAttendance",
  permission: "attendance:mark",
  schema: MarkAttendanceSchema,
  handler: async (input, { session }) => {
    // `attendance:mark` is also granted to STAFF so anyone can clock in — but
    // without hrms:manage they may only mark their own attendance, not any
    // arbitrary employeeId.
    if (!hasPermission(session.role, "hrms:manage")) {
      const employee = await service.getEmployee(input.employeeId)
      if (!employee || employee.userId !== session.userId) {
        throw new AuthorizationError()
      }
    }

    const row = await service.upsertAttendance({
      employeeId: input.employeeId,
      date: input.date,
      status: input.status,
      checkIn: input.checkIn || null,
      checkOut: input.checkOut || null,
      workedMinutes: workedMinutes(input.checkIn, input.checkOut),
      notes: input.notes,
      markedBy: session.userId,
    })
    revalidatePath("/admin/attendance")
    return row
  },
})

/** Saves the whole day's register in one call — how attendance is really taken. */
export const saveAttendanceDay = defineAction({
  name: "saveAttendanceDay",
  permission: "attendance:mark",
  schema: BulkAttendanceSchema,
  handler: async ({ date, entries }, { session }) => {
    for (const entry of entries) {
      await service.upsertAttendance({
        employeeId: entry.employeeId,
        date,
        status: entry.status,
        checkIn: entry.checkIn || null,
        checkOut: entry.checkOut || null,
        workedMinutes: workedMinutes(entry.checkIn, entry.checkOut),
        markedBy: session.userId,
      })
    }

    await recordAudit({
      entity: "attendance",
      action: "update",
      summary: `Marked attendance for ${entries.length} employees on ${date}`,
      session,
    })

    revalidatePath("/admin/attendance")
    return { count: entries.length }
  },
})

// ------------------------------------------------------------------- leaves

export const fetchLeaves = defineAction({
  name: "fetchLeaves",
  permission: "hrms:view",
  schema: LeaveListParamsSchema,
  handler: async (params) => service.listLeaves(params),
})

/**
 * Records a leave request on an employee's behalf — staff tell their manager,
 * the manager enters it here. `days` is derived from the date range rather than
 * typed, so the register and the leave list can never disagree about the length.
 */
export const requestLeave = defineAction({
  name: "requestLeave",
  permission: "hrms:manage",
  schema: LeaveRequestSchema,
  handler: async (input, { session }) => {
    const employee = await service.getEmployee(input.employeeId)
    if (!employee) throw new ActionFailure("Employee not found")

    const days =
      differenceInCalendarDays(parseISO(input.toDate), parseISO(input.fromDate)) + 1

    const leave = await service.createLeave({
      ...input,
      days: Math.max(1, days),
    })

    await recordAudit({
      entity: "leave_requests",
      entityId: leave.id,
      action: "create",
      summary: `Leave recorded for ${employee.name}`,
      session,
    })

    revalidatePath("/admin/attendance")
    return leave
  },
})

export const decideLeave = defineAction({
  name: "decideLeave",
  // Narrower than hrms:manage on purpose — a manager records leave, but only
  // Admin and Super Admin approve or reject it.
  permission: "leave:approve",
  schema: DecideLeaveSchema,
  handler: async ({ id, status, decisionNote }, { session }) => {
    const leave = await service.decideLeave(id, {
      status,
      decisionNote,
      decidedBy: session.userId,
      decidedAt: new Date(),
    })
    if (!leave) throw new ActionFailure("Leave request not found")

    await recordAudit({
      entity: "leave_requests",
      entityId: id,
      action: "approve",
      summary: `Leave request ${status}`,
      session,
    })

    revalidatePath("/admin/attendance")
    return leave
  },
})

export const fetchEmployeeOptions = defineAction({
  name: "fetchEmployeeOptions",
  permission: "hrms:view",
  schema: z.object({ search: z.string().optional() }),
  handler: async () => {
    const result = await service.listEmployees({
      page: 1,
      pageSize: 100,
      sortDir: "asc",
      status: "active",
    } as never)
    return result.rows.map((e) => ({ id: e.id, name: e.name, empCode: e.empCode }))
  },
})
