import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { customers, leadSourceEnum } from "./customer.schema"
import { users } from "./user.schema"

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
])

export const leadPriorityEnum = pgEnum("lead_priority", [
  "low",
  "medium",
  "high",
])

export const followupStatusEnum = pgEnum("followup_status", [
  "pending",
  "done",
  "missed",
  "cancelled",
])

export const followupChannelEnum = pgEnum("followup_channel", [
  "call",
  "whatsapp",
  "email",
  "visit",
  "other",
])

/** An enquiry. Created when someone calls, walks in, or messages. */
export const leads = pgTable(
  "leads",
  {
    id: pk(),
    /** Human-facing sequential code, e.g. LEAD-000123. */
    code: text("code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    destination: text("destination"),
    /** Rough travel window quoted by the customer — firms up at booking. */
    travelDate: date("travel_date"),
    durationDays: integer("duration_days"),
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    /** Customer's stated budget, in paise. */
    budget: money("budget"),
    status: leadStatusEnum("status").notNull().default("new"),
    priority: leadPriorityEnum("priority").notNull().default("medium"),
    source: leadSourceEnum("source").notNull().default("walk_in"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    requirements: text("requirements"),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("leads_code_key").on(t.code),
    index("leads_status_idx").on(t.status),
    index("leads_assigned_to_idx").on(t.assignedTo),
    index("leads_customer_idx").on(t.customerId),
    index("leads_created_at_idx").on(t.createdAt),
  ]
)

/**
 * A dated task against a lead. This is the single most-used screen in the
 * product — staff live in the "due today / overdue" queue.
 */
export const leadFollowups = pgTable(
  "lead_followups",
  {
    id: pk(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    channel: followupChannelEnum("channel").notNull().default("call"),
    note: text("note"),
    status: followupStatusEnum("status").notNull().default("pending"),
    /** What actually happened, filled in when the follow-up is completed. */
    outcome: text("outcome"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: actor("completed_by"),
    createdBy: actor("created_by"),
    ...timestamps,
  },
  (t) => [
    index("lead_followups_lead_idx").on(t.leadId),
    index("lead_followups_due_idx").on(t.dueAt),
    index("lead_followups_status_due_idx").on(t.status, t.dueAt),
    index("lead_followups_assigned_idx").on(t.assignedTo),
  ]
)

/** Append-only activity trail shown on the lead detail timeline. */
export const leadActivities = pgTable(
  "lead_activities",
  {
    id: pk(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    createdBy: actor("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("lead_activities_lead_idx").on(t.leadId, t.createdAt)]
)

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
export type LeadFollowup = typeof leadFollowups.$inferSelect
export type NewLeadFollowup = typeof leadFollowups.$inferInsert
export type LeadActivity = typeof leadActivities.$inferSelect
