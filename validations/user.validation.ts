import { z } from "zod"
import { userRoleEnum } from "@/db/schemas/user.schema"
import {
  listParamsSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const USER_ROLES = userRoleEnum.enumValues
export const userRoleSchema = z.enum(USER_ROLES)

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(40, "Username must be 40 characters or fewer")
  .regex(
    /^[a-z0-9._-]+$/,
    "Use only lowercase letters, numbers, dots, hyphens and underscores"
  )

/**
 * 8 characters minimum with a letter and a digit. Deliberately modest — long
 * arbitrary rules push staff towards writing passwords on a sticky note.
 */
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include a letter and a number")

export const CreateUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: optionalText(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  role: userRoleSchema.default("staff"),
  isActive: z.boolean().default(true),
})

/** Password is changed through its own action, never as a side effect of edit. */
export const UpdateUserSchema = z.object({
  id: uuidSchema,
  name: optionalText(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  role: userRoleSchema,
  isActive: z.boolean(),
})

export const UserFormSchema = z.object({
  username: usernameSchema,
  password: z.string().optional(),
  name: optionalText(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  role: userRoleSchema.default("staff"),
  isActive: z.boolean().default(true),
})

export const ResetPasswordSchema = z.object({
  id: uuidSchema,
  password: passwordSchema,
})

export const DeleteUserSchema = z.object({ id: uuidSchema })

export const UserListParamsSchema = listParamsSchema.extend({
  role: userRoleSchema.optional(),
  isActive: z.enum(["true", "false"]).optional(),
})

export type UserFormValues = z.input<typeof UserFormSchema>
export type UserListParams = z.output<typeof UserListParamsSchema>
export { requiredText }
