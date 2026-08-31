"use server"

import { revalidatePath } from "next/cache"
import { ActionFailure, AuthorizationError, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { nextLeadCode } from "@/lib/codes"
import { canViewAll } from "@/lib/rbac"
import * as customerService from "@/lib/services/customer.service"
import * as followupService from "@/lib/services/followup.service"
import * as leadService from "@/lib/services/lead.service"
import {
  AssignLeadSchema,
  CompleteFollowupSchema,
  CreateFollowupSchema,
  CreateLeadSchema,
  DeleteFollowupSchema,
  DeleteLeadSchema,
  FollowupQueueParamsSchema,
  LEAD_STATUS_LABELS,
  LeadListParamsSchema,
  UpdateFollowupSchema,
  UpdateLeadSchema,
  UpdateLeadStatusSchema,
} from "@/validations/lead.validation"
import { uuidSchema } from "@/validations/common.validation"
import { z } from "zod"
import type { SessionPayload } from "@/types/auth"

/** Sales staff only ever see their own pipeline; managers and up see everything. */
function scopeFor(session: SessionPayload): string | null {
  return canViewAll(session.role, "lead") ? null : session.userId
}

/**
 * `scopeFor` restricts list views to a sales user's own pipeline, but a
 * per-record action reached by id has to re-apply the same restriction
 * itself — otherwise a sales user can act on any lead by id/URL even though
 * it's filtered out of their own list view.
 */
function assertLeadInScope(
  session: SessionPayload,
  lead: { assignedTo: string | null }
): void {
  const scope = scopeFor(session)
  if (scope && lead.assignedTo !== scope) {
    throw new AuthorizationError()
  }
}

export const fetchLeads = defineAction({
  name: "fetchLeads",
  permission: "lead:view",
  schema: LeadListParamsSchema,
  handler: async (params, { session }) =>
    leadService.listLeads(params, scopeFor(session)),
})

export const fetchLeadStats = defineAction({
  name: "fetchLeadStats",
  permission: "lead:view",
  handler: async (_input: void, { session }) =>
    leadService.getLeadStats(scopeFor(session)),
})

export const fetchAssignableUsers = defineAction({
  name: "fetchAssignableUsers",
  permission: "lead:view",
  handler: async (_input: void) => leadService.getAssignableUsers(),
})

export const fetchLeadActivities = defineAction({
  name: "fetchLeadActivities",
  permission: "lead:view",
  schema: z.object({ leadId: uuidSchema }),
  handler: async ({ leadId }) => leadService.getLeadActivities(leadId),
})

export const fetchLeadDestinations = defineAction({
  name: "fetchLeadDestinations",
  permission: "lead:view",
  schema: z.object({ leadId: uuidSchema }),
  handler: async ({ leadId }) => leadService.listDestinations(leadId),
})

/**
 * Creating a lead also resolves the customer: an existing phone number reuses
 * that record, a new one creates it. Staff taking a call should never have to
 * think about whether the caller is already in the system.
 */
export const createLead = defineAction({
  name: "createLead",
  permission: "lead:create",
  schema: CreateLeadSchema,
  handler: async (input, { session }) => {
    if (!input.customerId && !(input.customerName && input.customerPhone)) {
      throw new ActionFailure("Select a customer or enter a name and phone number")
    }

    const { customer, created } = input.customerId
      ? {
          customer:
            (await customerService.getCustomer(input.customerId)) ??
            (() => {
              throw new ActionFailure("Selected customer no longer exists")
            })(),
          created: false,
        }
      : await customerService.upsertCustomerByPhone(
          {
            name: input.customerName!,
            phone: input.customerPhone!,
            source: input.source,
          },
          session.userId
        )

    const code = await nextLeadCode()

    const lead = await leadService.createLead({
      code,
      customerId: customer.id,
      destination: leadService.joinDestinations(input.destinations),
      travelDate: input.travelDate ?? null,
      durationDays: input.durationDays ?? null,
      adults: input.adults,
      children: input.children,
      budget: input.budget ?? null,
      status: input.status,
      priority: input.priority,
      source: input.source,
      assignedTo: input.assignedTo ?? session.userId,
      requirements: input.requirements,
      createdBy: session.userId,
    })

    await leadService.replaceDestinations(
      lead.id,
      input.destinations.map((d) => ({ destination: d.destination, days: d.days ?? null }))
    )

    await leadService.logActivity(
      lead.id,
      "created",
      `Enquiry ${code} created for ${customer.name}${created ? " (new customer)" : ""}`,
      session.userId
    )

    // An enquiry with no scheduled next action is how leads go cold, so the
    // first follow-up is created alongside the lead when one was supplied.
    if (input.followupAt) {
      await followupService.createFollowup({
        leadId: lead.id,
        dueAt: new Date(input.followupAt),
        note: input.followupNote ?? null,
        assignedTo: input.assignedTo ?? session.userId,
        createdBy: session.userId,
      })
    }

    await recordAudit({
      entity: "leads",
      entityId: lead.id,
      action: "create",
      summary: `Created lead ${code}`,
      session,
    })

    revalidatePath("/admin/leads")
    return lead
  },
})

export const updateLead = defineAction({
  name: "updateLead",
  permission: "lead:update",
  schema: UpdateLeadSchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await leadService.getLeadRaw(id)
    if (!before) throw new ActionFailure("Lead not found")
    assertLeadInScope(session, before)

    const { destinations, ...rest } = values

    const lead = await leadService.updateLead(id, {
      ...rest,
      destination: leadService.joinDestinations(destinations),
      travelDate: values.travelDate ?? null,
      durationDays: values.durationDays ?? null,
      budget: values.budget ?? null,
      assignedTo: values.assignedTo ?? null,
    })
    if (!lead) throw new ActionFailure("Lead not found")

    await leadService.replaceDestinations(
      id,
      destinations.map((d) => ({ destination: d.destination, days: d.days ?? null }))
    )

    await recordAudit({
      entity: "leads",
      entityId: id,
      action: "update",
      summary: `Updated lead ${lead.code}`,
      changes: diffChanges(before, lead),
      session,
    })

    revalidatePath("/admin/leads")
    return lead
  },
})

export const updateLeadStatus = defineAction({
  name: "updateLeadStatus",
  permission: "lead:update",
  schema: UpdateLeadStatusSchema,
  handler: async ({ id, status, lostReason }, { session }) => {
    const before = await leadService.getLeadRaw(id)
    if (!before) throw new ActionFailure("Lead not found")
    assertLeadInScope(session, before)
    if (before.status === status) return before

    const isClosing = status === "won" || status === "lost"

    const lead = await leadService.updateLead(id, {
      status,
      lostReason: status === "lost" ? lostReason : null,
      closedAt: isClosing ? new Date() : null,
    })
    if (!lead) throw new ActionFailure("Lead not found")

    await leadService.logActivity(
      id,
      "status_change",
      `Status changed from ${LEAD_STATUS_LABELS[before.status]} to ${LEAD_STATUS_LABELS[status]}` +
        (status === "lost" && lostReason ? ` — ${lostReason}` : ""),
      session.userId
    )

    await recordAudit({
      entity: "leads",
      entityId: id,
      action: "status_change",
      summary: `${lead.code}: ${before.status} → ${status}`,
      changes: { status: { from: before.status, to: status } },
      session,
    })

    revalidatePath("/admin/leads")
    return lead
  },
})

export const assignLead = defineAction({
  name: "assignLead",
  permission: "lead:assign",
  schema: AssignLeadSchema,
  handler: async ({ id, assignedTo }, { session }) => {
    const before = await leadService.getLeadRaw(id)
    if (!before) throw new ActionFailure("Lead not found")
    assertLeadInScope(session, before)

    const lead = await leadService.updateLead(id, { assignedTo })
    if (!lead) throw new ActionFailure("Lead not found")

    await leadService.logActivity(
      id,
      "assigned",
      assignedTo ? "Lead reassigned" : "Lead unassigned",
      session.userId
    )

    await recordAudit({
      entity: "leads",
      entityId: id,
      action: "assign",
      summary: `Reassigned lead ${lead.code}`,
      session,
    })

    revalidatePath("/admin/leads")
    return lead
  },
})

export const deleteLead = defineAction({
  name: "deleteLead",
  permission: "lead:delete",
  schema: DeleteLeadSchema,
  handler: async ({ id }, { session }) => {
    const before = await leadService.getLeadRaw(id)
    if (!before) throw new ActionFailure("Lead not found")
    assertLeadInScope(session, before)
    if (before.status === "won") {
      throw new ActionFailure(
        "Won leads cannot be deleted — they are linked to a booking"
      )
    }

    await leadService.softDeleteLead(id)

    await recordAudit({
      entity: "leads",
      entityId: id,
      action: "delete",
      summary: `Deleted lead ${before.code}`,
      session,
    })

    revalidatePath("/admin/leads")
    return { id }
  },
})

// ---------------------------------------------------------------- follow-ups

export const fetchFollowups = defineAction({
  name: "fetchFollowups",
  permission: "lead:view",
  schema: FollowupQueueParamsSchema,
  handler: async (params, { session }) =>
    followupService.listFollowups(params, scopeFor(session)),
})

export const fetchFollowupCounts = defineAction({
  name: "fetchFollowupCounts",
  permission: "lead:view",
  handler: async (_input: void, { session }) =>
    followupService.getFollowupCounts(scopeFor(session)),
})

export const fetchFollowupsByLead = defineAction({
  name: "fetchFollowupsByLead",
  permission: "lead:view",
  schema: z.object({ leadId: uuidSchema }),
  handler: async ({ leadId }) => followupService.listFollowupsByLead(leadId),
})

export const createFollowup = defineAction({
  name: "createFollowup",
  permission: "lead:update",
  schema: CreateFollowupSchema,
  handler: async (input, { session }) => {
    const lead = await leadService.getLeadRaw(input.leadId)
    if (!lead) throw new ActionFailure("Lead not found")

    const followup = await followupService.createFollowup({
      leadId: input.leadId,
      dueAt: new Date(input.dueAt),
      channel: input.channel,
      note: input.note,
      assignedTo: input.assignedTo ?? lead.assignedTo ?? session.userId,
      createdBy: session.userId,
    })

    await leadService.logActivity(
      input.leadId,
      "followup_scheduled",
      `Follow-up scheduled via ${input.channel}`,
      session.userId
    )

    revalidatePath("/admin/followups")
    revalidatePath("/admin/leads")
    return followup
  },
})

export const updateFollowup = defineAction({
  name: "updateFollowup",
  permission: "lead:update",
  schema: UpdateFollowupSchema,
  handler: async ({ id, ...values }) => {
    const followup = await followupService.updateFollowup(id, {
      dueAt: new Date(values.dueAt),
      channel: values.channel,
      note: values.note,
      assignedTo: values.assignedTo ?? null,
    })
    if (!followup) throw new ActionFailure("Follow-up not found")

    revalidatePath("/admin/followups")
    return followup
  },
})

/**
 * Completing a follow-up is the moment the pipeline actually moves, so this one
 * action records the outcome, optionally advances the lead status, and
 * optionally schedules the next follow-up — all from a single dialog.
 */
export const completeFollowup = defineAction({
  name: "completeFollowup",
  permission: "lead:update",
  schema: CompleteFollowupSchema,
  handler: async (input, { session }) => {
    const existing = await followupService.getFollowup(input.id)
    if (!existing) throw new ActionFailure("Follow-up not found")
    if (existing.status === "done") {
      throw new ActionFailure("This follow-up is already completed")
    }

    const followup = await followupService.updateFollowup(input.id, {
      status: "done",
      outcome: input.outcome,
      completedAt: new Date(),
      completedBy: session.userId,
    })

    await leadService.logActivity(
      existing.leadId,
      "followup_done",
      input.outcome,
      session.userId
    )

    if (input.nextStatus) {
      const lead = await leadService.getLeadRaw(existing.leadId)
      if (lead && lead.status !== input.nextStatus) {
        const closing = input.nextStatus === "won" || input.nextStatus === "lost"
        await leadService.updateLead(existing.leadId, {
          status: input.nextStatus,
          closedAt: closing ? new Date() : null,
        })
        await leadService.logActivity(
          existing.leadId,
          "status_change",
          `Status changed from ${LEAD_STATUS_LABELS[lead.status]} to ${LEAD_STATUS_LABELS[input.nextStatus]}`,
          session.userId
        )
      }
    }

    let next = null
    if (input.nextDueAt) {
      next = await followupService.createFollowup({
        leadId: existing.leadId,
        dueAt: new Date(input.nextDueAt),
        channel: existing.channel,
        note: input.nextNote ?? null,
        assignedTo: existing.assignedTo,
        createdBy: session.userId,
      })
    }

    await recordAudit({
      entity: "lead_followups",
      entityId: input.id,
      action: "update",
      summary: "Completed follow-up",
      session,
    })

    revalidatePath("/admin/followups")
    revalidatePath("/admin/leads")
    return { followup, next }
  },
})

export const deleteFollowup = defineAction({
  name: "deleteFollowup",
  permission: "lead:update",
  schema: DeleteFollowupSchema,
  handler: async ({ id }) => {
    await followupService.deleteFollowup(id)
    revalidatePath("/admin/followups")
    return { id }
  },
})
