import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { users } from "./user.schema"

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_leave",
  "resigned",
  "terminated",
])

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "week_off",
])

export const leaveTypeEnum = pgEnum("leave_type", [
  "casual",
  "sick",
  "paid",
  "unpaid",
  "comp_off",
])

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
])

export const employees = pgTable(
  "employees",
  {
    id: pk(),
    /** Optional link to a login account — not every employee needs one. */
    userId: uuid("user_id").references(() => users.id),
    empCode: text("emp_code").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    designation: text("designation"),
    department: text("department"),
    dateOfJoining: date("date_of_joining"),
    dateOfBirth: date("date_of_birth"),
    address: text("address"),
    /** Gross monthly salary in paise. */
    monthlySalary: money("monthly_salary"),
    emergencyContact: text("emergency_contact"),
    status: employeeStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("employees_emp_code_key").on(t.empCode),
    index("employees_status_idx").on(t.status),
    index("employees_user_idx").on(t.userId),
  ]
)

export const attendance = pgTable(
  "attendance",
  {
    id: pk(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    checkIn: time("check_in"),
    checkOut: time("check_out"),
    /** Computed on check-out, stored so monthly reports stay cheap. */
    workedMinutes: integer("worked_minutes"),
    notes: text("notes"),
    markedBy: actor("marked_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_employee_date_key").on(t.employeeId, t.date),
    index("attendance_date_idx").on(t.date),
  ]
)

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: pk(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: leaveTypeEnum("type").notNull().default("casual"),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    /** Whole days; half-days are recorded as 0.5 rounded up in the UI layer. */
    days: integer("days").notNull().default(1),
    reason: text("reason"),
    status: leaveStatusEnum("status").notNull().default("pending"),
    decidedBy: actor("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    ...timestamps,
  },
  (t) => [
    index("leave_requests_employee_idx").on(t.employeeId),
    index("leave_requests_status_idx").on(t.status),
    index("leave_requests_dates_idx").on(t.fromDate, t.toDate),
  ]
)

export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type Attendance = typeof attendance.$inferSelect
export type NewAttendance = typeof attendance.$inferInsert
export type LeaveRequest = typeof leaveRequests.$inferSelect
export type NewLeaveRequest = typeof leaveRequests.$inferInsert
