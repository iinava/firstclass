import { z } from "zod"
import {
  listParamsSchema,
  optionalDateString,
  optionalMoneySchema,
  optionalText,
  phoneSchema,
  requiredText,
  uuidSchema,
} from "./common.validation"
import { leadSourceSchema } from "./customer.validation"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
] as const

export const LEAD_PRIORITIES = ["low", "medium", "high"] as const

export const FOLLOWUP_STATUSES = ["pending", "done", "missed", "cancelled"] as const

export const FOLLOWUP_CHANNELS = ["call", "whatsapp", "email", "visit", "other"] as const

export const leadStatusSchema = z.enum(LEAD_STATUSES)
export const leadPrioritySchema = z.enum(LEAD_PRIORITIES)
export const followupStatusSchema = z.enum(FOLLOWUP_STATUSES)
export const followupChannelSchema = z.enum(FOLLOWUP_CHANNELS)

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
}

export const FOLLOWUP_CHANNEL_LABELS: Record<
  (typeof FOLLOWUP_CHANNELS)[number],
  string
> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visit",
  other: "Other",
}

/**
 * Creating a lead also creates (or reuses) a customer, so the form carries the
 * customer fields inline — staff should never have to create a customer record
 * as a separate step while someone is on the phone.
 */
export const CreateLeadSchema = z.object({
  // Either pick an existing customer...
  customerId: uuidSchema.optional().nullable(),
  // ...or supply these to create/match one by phone.
  customerName: requiredText("Customer name", 120),
  customerPhone: phoneSchema,

  destination: optionalText(160),
  travelDate: optionalDateString,
  durationDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  adults: z.coerce.number().int().min(1, "At least 1 adult").max(200).default(1),
  children: z.coerce.number().int().min(0).max(200).default(0),
  budget: optionalMoneySchema,
  status: leadStatusSchema.default("new"),
  priority: leadPrioritySchema.default("medium"),
  source: leadSourceSchema.default("phone"),
  assignedTo: uuidSchema.optional().nullable(),
  requirements: optionalText(2000),

  /** Optional first follow-up, scheduled at creation time. */
  followupAt: z.string().optional().nullable(),
  followupNote: optionalText(500),
})

export const UpdateLeadSchema = z.object({
  id: uuidSchema,
  destination: optionalText(160),
  travelDate: optionalDateString,
  durationDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  adults: z.coerce.number().int().min(1).max(200),
  children: z.coerce.number().int().min(0).max(200),
  budget: optionalMoneySchema,
  priority: leadPrioritySchema,
  source: leadSourceSchema,
  assignedTo: uuidSchema.optional().nullable(),
  requirements: optionalText(2000),
})

export const UpdateLeadStatusSchema = z
  .object({
    id: uuidSchema,
    status: leadStatusSchema,
    lostReason: optionalText(500),
  })
  .refine(
    (v) => v.status !== "lost" || !!v.lostReason,
    { message: "Please record why this lead was lost", path: ["lostReason"] }
  )

export const AssignLeadSchema = z.object({
  id: uuidSchema,
  assignedTo: uuidSchema.nullable(),
})

export const DeleteLeadSchema = z.object({ id: uuidSchema })

export const LeadListParamsSchema = listParamsSchema.extend({
  status: leadStatusSchema.optional(),
  priority: leadPrioritySchema.optional(),
  source: leadSourceSchema.optional(),
  assignedTo: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ---------------------------------------------------------------- follow-ups

export const CreateFollowupSchema = z.object({
  leadId: uuidSchema,
  dueAt: z.string().min(1, "Pick a date and time"),
  channel: followupChannelSchema.default("call"),
  note: optionalText(500),
  assignedTo: uuidSchema.optional().nullable(),
})

export const UpdateFollowupSchema = z.object({
  id: uuidSchema,
  dueAt: z.string().min(1, "Pick a date and time"),
  channel: followupChannelSchema,
  note: optionalText(500),
  assignedTo: uuidSchema.optional().nullable(),
})

export const CompleteFollowupSchema = z.object({
  id: uuidSchema,
  outcome: requiredText("Outcome", 1000),
  /** Optionally chain the next follow-up in the same step. */
  nextDueAt: z.string().optional().nullable(),
  nextNote: optionalText(500),
  /** Optionally move the lead forward at the same time. */
  nextStatus: leadStatusSchema.optional().nullable(),
})

export const DeleteFollowupSchema = z.object({ id: uuidSchema })

/** Drives the "Today / Overdue / Upcoming" tabs on the follow-up queue. */
export const FollowupQueueParamsSchema = listParamsSchema.extend({
  bucket: z.enum(["overdue", "today", "week", "upcoming", "all"]).default("today"),
  assignedTo: z.string().optional(),
  status: followupStatusSchema.optional(),
})

export type CreateLeadInput = z.output<typeof CreateLeadSchema>
export type CreateLeadValues = z.input<typeof CreateLeadSchema>
export type UpdateLeadInput = z.output<typeof UpdateLeadSchema>
export type UpdateLeadValues = z.input<typeof UpdateLeadSchema>
export type LeadListParams = z.output<typeof LeadListParamsSchema>
export type CreateFollowupValues = z.input<typeof CreateFollowupSchema>
export type CompleteFollowupValues = z.input<typeof CompleteFollowupSchema>
export type FollowupQueueParams = z.output<typeof FollowupQueueParamsSchema>
