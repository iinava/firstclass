import { z } from "zod"
import {
  dateStringSchema,
  listParamsSchema,
  optionalDateString,
  optionalEmailSchema,
  optionalMoneySchema,
  optionalText,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const EMPLOYEE_STATUSES = ["active", "on_leave", "resigned", "terminated"] as const
export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "week_off",
  "leave_unpaid",
] as const
export const LEAVE_TYPES = ["casual", "sick", "paid", "unpaid", "comp_off"] as const
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const

export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES)
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES)
export const leaveTypeSchema = z.enum(LEAVE_TYPES)
export const leaveStatusSchema = z.enum(LEAVE_STATUSES)

export const ATTENDANCE_STATUS_LABELS: Record<
  (typeof ATTENDANCE_STATUSES)[number],
  string
> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  leave: "Leave",
  holiday: "Holiday",
  week_off: "Week off",
  leave_unpaid: "Leave (unpaid)",
}

export const LEAVE_TYPE_LABELS: Record<(typeof LEAVE_TYPES)[number], string> = {
  casual: "Casual",
  sick: "Sick",
  paid: "Paid",
  unpaid: "Unpaid",
  comp_off: "Comp off",
}

export const EmployeeFormSchema = z.object({
  name: requiredText("Name", 120),
  phone: phoneSchema,
  email: optionalEmailSchema,
  designation: optionalText(80),
  department: optionalText(80),
  dateOfJoining: optionalDateString,
  dateOfBirth: optionalDateString,
  address: optionalText(300),
  dayRate: optionalMoneySchema,
  paidLeavesPerMonth: z.coerce.number().int().min(0).max(31).default(2),
  emergencyContact: optionalText(120),
  userId: uuidSchema.nullable().optional(),
  status: employeeStatusSchema.default("active"),
  notes: optionalText(1000),
})

export const CreateEmployeeSchema = EmployeeFormSchema
export const UpdateEmployeeSchema = EmployeeFormSchema.extend({ id: uuidSchema })
export const DeleteEmployeeSchema = z.object({ id: uuidSchema })

export const EmployeeListParamsSchema = listParamsSchema.extend({
  status: employeeStatusSchema.optional(),
  department: z.string().optional(),
})

// --------------------------------------------------------------- attendance

export const MarkAttendanceSchema = z.object({
  employeeId: uuidSchema,
  date: dateStringSchema,
  status: attendanceStatusSchema.default("present"),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  notes: optionalText(300),
})

/** Marking a whole day at once is how attendance actually gets recorded. */
export const BulkAttendanceSchema = z.object({
  date: dateStringSchema,
  entries: z
    .array(
      z.object({
        employeeId: uuidSchema,
        status: attendanceStatusSchema,
        checkIn: z.string().optional().nullable(),
        checkOut: z.string().optional().nullable(),
      })
    )
    .min(1, "Nothing to save"),
})

export const AttendanceListParamsSchema = z.object({
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  employeeId: z.string().optional(),
})

// ------------------------------------------------------------------- leaves

export const LeaveRequestSchema = z
  .object({
    employeeId: uuidSchema,
    type: leaveTypeSchema.default("casual"),
    fromDate: dateStringSchema,
    toDate: dateStringSchema,
    reason: optionalText(500),
  })
  .refine((v) => v.toDate >= v.fromDate, {
    message: "End date cannot be before the start date",
    path: ["toDate"],
  })

export const DecideLeaveSchema = z.object({
  id: uuidSchema,
  status: z.enum(["approved", "rejected"]),
  decisionNote: optionalText(300),
})

export const LeaveListParamsSchema = listParamsSchema.extend({
  status: leaveStatusSchema.optional(),
  employeeId: z.string().optional(),
})

export type EmployeeFormValues = z.input<typeof EmployeeFormSchema>
export type EmployeeListParams = z.output<typeof EmployeeListParamsSchema>
export type AttendanceListParams = z.output<typeof AttendanceListParamsSchema>
export type LeaveRequestValues = z.input<typeof LeaveRequestSchema>
export type LeaveListParams = z.output<typeof LeaveListParamsSchema>
export type BulkAttendanceValues = z.input<typeof BulkAttendanceSchema>
