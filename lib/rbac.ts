import type { UserRole } from "@/types/auth"

/**
 * Permission matrix.
 *
 * Permissions are `<resource>:<action>` strings. Server actions call
 * `requirePermission()` — checking only in `proxy.ts` is not enough, because
 * a server action is a public HTTP endpoint that anyone with a session can POST
 * to directly, regardless of which page rendered the button.
 */
export const PERMISSIONS = [
  "dashboard:view",

  "customer:view",
  "customer:create",
  "customer:update",
  "customer:delete",

  "lead:view",
  "lead:view_all", // without this, a user only sees leads assigned to them
  "lead:create",
  "lead:update",
  "lead:delete",
  "lead:assign",

  "itinerary:view",
  "itinerary:create",
  "itinerary:update",
  "itinerary:delete",
  "itinerary:publish",

  "booking:view",
  "booking:view_all",
  "booking:create",
  "booking:update",
  "booking:delete",
  "booking:cancel",

  "supplier:view",
  "supplier:create",
  "supplier:update",
  "supplier:delete",

  "vehicle:view",
  "vehicle:create",
  "vehicle:update",
  "vehicle:delete",

  "cost:view",
  "cost:create",
  "cost:update",
  "cost:delete",

  "invoice:view",
  "invoice:create",
  "invoice:update",
  "invoice:cancel",

  "payment:view",
  "payment:create",
  "payment:void",

  "expense:view",
  "expense:create",
  "expense:update",
  "expense:delete",
  "expense:approve",

  "hrms:view",
  "hrms:manage",
  "attendance:mark",

  "report:view",
  "report:financial",

  "user:view",
  "user:manage",

  "settings:view",
  "settings:manage",

  "audit:view",
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL: Permission[] = [...PERMISSIONS]

const SALES: Permission[] = [
  "dashboard:view",
  "customer:view",
  "customer:create",
  "customer:update",
  "lead:view",
  "lead:create",
  "lead:update",
  "itinerary:view",
  "itinerary:create",
  "itinerary:update",
  "booking:view",
  "booking:create",
  "booking:update",
  "report:view",
]

const OPS: Permission[] = [
  "dashboard:view",
  "customer:view",
  "booking:view",
  "booking:view_all",
  "booking:update",
  "itinerary:view",
  "supplier:view",
  "supplier:create",
  "supplier:update",
  "vehicle:view",
  "vehicle:create",
  "vehicle:update",
  "cost:view",
  "cost:create",
  "cost:update",
  "cost:delete",
  "expense:view",
  "expense:create",
  "report:view",
]

const ACCOUNTS: Permission[] = [
  "dashboard:view",
  "customer:view",
  "booking:view",
  "booking:view_all",
  "supplier:view",
  "vehicle:view",
  "cost:view",
  "cost:update",
  "invoice:view",
  "invoice:create",
  "invoice:update",
  "invoice:cancel",
  "payment:view",
  "payment:create",
  "payment:void",
  "expense:view",
  "expense:create",
  "expense:update",
  "expense:approve",
  "report:view",
  "report:financial",
]

const MANAGER: Permission[] = [
  ...new Set<Permission>([
    ...SALES,
    ...OPS,
    ...ACCOUNTS,
    "lead:view_all",
    "lead:assign",
    "lead:delete",
    "booking:cancel",
    "booking:delete",
    "itinerary:publish",
    "itinerary:delete",
    "customer:delete",
    "hrms:view",
    "hrms:manage",
    "attendance:mark",
    "audit:view",
  ]),
]

const STAFF: Permission[] = [
  "dashboard:view",
  "customer:view",
  "lead:view",
  "itinerary:view",
  "booking:view",
  "attendance:mark",
]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: ALL,
  admin: ALL.filter((p) => p !== "user:manage"),
  manager: MANAGER,
  accounts: ACCOUNTS,
  sales: SALES,
  ops: OPS,
  staff: STAFF,
}

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  accounts: "Accounts",
  sales: "Sales",
  ops: "Operations",
  staff: "Staff",
}

/** Pure check — safe to use on the client for hiding UI. */
export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * True when the user may see records they don't own. Sales staff are scoped to
 * their own leads/bookings; everyone above them sees the whole pipeline.
 */
export function canViewAll(
  role: UserRole | null | undefined,
  resource: "lead" | "booking"
): boolean {
  return hasPermission(role, `${resource}:view_all` as Permission)
}
