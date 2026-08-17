import "server-only"
import { headers } from "next/headers"
import { db } from "@/db/drizzle"
import { auditLogs } from "@/db/schemas/system.schema"
import type { SessionPayload } from "@/types/auth"

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "void"
  | "cancel"
  | "status_change"
  | "login"
  | "logout"
  | "assign"
  | "approve"

interface AuditInput {
  entity: string
  entityId?: string | null
  action: AuditAction
  summary?: string
  changes?: Record<string, unknown> | null
  session?: SessionPayload | null
}

/** Fields that must never be written into the audit trail. */
const REDACTED = new Set(["passwordHash", "password", "shareToken"])

/**
 * Diff two records down to only the fields that actually changed.
 * Keeps the audit table small and the timeline readable.
 */
export function diffChanges<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: Partial<T> | null | undefined
): Record<string, { from: unknown; to: unknown }> | null {
  if (!after) return null
  const changes: Record<string, { from: unknown; to: unknown }> = {}

  for (const [key, next] of Object.entries(after)) {
    if (REDACTED.has(key)) continue
    if (key === "updatedAt" || key === "createdAt") continue
    const prev = before?.[key]
    const same =
      prev instanceof Date && next instanceof Date
        ? prev.getTime() === next.getTime()
        : JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)
    if (!same) changes[key] = { from: prev ?? null, to: next ?? null }
  }

  return Object.keys(changes).length ? changes : null
}

/**
 * Write an audit entry. Never throws — an audit failure must not roll back or
 * fail the user's actual operation, but it is logged loudly for investigation.
 */
export async function recordAudit({
  entity,
  entityId,
  action,
  summary,
  changes,
  session,
}: AuditInput): Promise<void> {
  try {
    let ipAddress: string | null = null
    try {
      const h = await headers()
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null
    } catch {
      // headers() is unavailable outside a request scope (e.g. scripts).
    }

    await db.insert(auditLogs).values({
      entity,
      entityId: entityId ?? null,
      action,
      summary: summary ?? null,
      changes: changes ?? null,
      userId: session?.userId ?? null,
      userName: session?.username ?? null,
      ipAddress,
    })
  } catch (error) {
    console.error("[audit] failed to record entry", { entity, action, error })
  }
}
