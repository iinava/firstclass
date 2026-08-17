"use server"

import { revalidatePath } from "next/cache"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import { hashPassword } from "@/lib/password"
import * as service from "@/lib/services/user.service"
import {
  CreateUserSchema,
  DeleteUserSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  UserListParamsSchema,
} from "@/validations/user.validation"

export const fetchUsers = defineAction({
  name: "fetchUsers",
  permission: "user:view",
  schema: UserListParamsSchema,
  handler: async (params) => service.listUsers(params),
})

export const createUser = defineAction({
  name: "createUser",
  permission: "user:manage",
  schema: CreateUserSchema,
  handler: async (input, { session }) => {
    const existing = await service.findByUsername(input.username)
    if (existing) {
      throw new ActionFailure("That username is already taken", {
        username: ["Already in use"],
      })
    }

    const user = await service.createUser({
      username: input.username,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      isActive: input.isActive,
    })

    await recordAudit({
      entity: "users",
      entityId: user.id,
      action: "create",
      summary: `Created ${input.role} account "${user.username}"`,
      session,
    })

    revalidatePath("/admin/users")
    // Never return the hash to the client.
    return { id: user.id, username: user.username }
  },
})

export const updateUser = defineAction({
  name: "updateUser",
  permission: "user:manage",
  schema: UpdateUserSchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await service.getUser(id)
    if (!before) throw new ActionFailure("User not found")

    // Guard rails against locking the business out of its own system.
    if (id === session.userId && values.role !== before.role) {
      throw new ActionFailure("You cannot change your own role")
    }
    if (id === session.userId && !values.isActive) {
      throw new ActionFailure("You cannot deactivate your own account")
    }
    if (
      before.role === "superadmin" &&
      (values.role !== "superadmin" || !values.isActive) &&
      (await service.countActiveSuperadmins(id)) === 0
    ) {
      throw new ActionFailure(
        "This is the last active super admin — promote someone else first"
      )
    }

    const user = await service.updateUser(id, values)
    if (!user) throw new ActionFailure("User not found")

    await recordAudit({
      entity: "users",
      entityId: id,
      action: "update",
      summary: `Updated account "${user.username}"`,
      changes: diffChanges(before, user),
      session,
    })

    revalidatePath("/admin/users")
    return { id: user.id, username: user.username }
  },
})

export const resetPassword = defineAction({
  name: "resetPassword",
  permission: "user:manage",
  schema: ResetPasswordSchema,
  handler: async ({ id, password }, { session }) => {
    const user = await service.getUser(id)
    if (!user) throw new ActionFailure("User not found")

    await service.updateUser(id, { passwordHash: await hashPassword(password) })

    await recordAudit({
      entity: "users",
      entityId: id,
      action: "update",
      // The password itself is never logged, only that it changed.
      summary: `Reset password for "${user.username}"`,
      session,
    })

    revalidatePath("/admin/users")
    return { id }
  },
})

/**
 * Accounts are deactivated, never deleted — audit entries, assigned leads and
 * bookings all reference the user id.
 */
export const deactivateUser = defineAction({
  name: "deactivateUser",
  permission: "user:manage",
  schema: DeleteUserSchema,
  handler: async ({ id }, { session }) => {
    const user = await service.getUser(id)
    if (!user) throw new ActionFailure("User not found")
    if (id === session.userId) {
      throw new ActionFailure("You cannot deactivate your own account")
    }
    if (
      user.role === "superadmin" &&
      (await service.countActiveSuperadmins(id)) === 0
    ) {
      throw new ActionFailure(
        "This is the last active super admin — promote someone else first"
      )
    }

    await service.updateUser(id, { isActive: false })

    await recordAudit({
      entity: "users",
      entityId: id,
      action: "update",
      summary: `Deactivated account "${user.username}"`,
      session,
    })

    revalidatePath("/admin/users")
    return { id }
  },
})
