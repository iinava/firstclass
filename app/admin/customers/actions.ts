"use server"

import { revalidatePath } from "next/cache"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import * as customerService from "@/lib/services/customer.service"
import {
  CreateCustomerSchema,
  CustomerListParamsSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/validations/customer.validation"

/**
 * Read action used by TanStack Query on the client. Reads go through the same
 * permission gate as writes — a server action is a public endpoint.
 */
export const fetchCustomers = defineAction({
  name: "fetchCustomers",
  permission: "customer:view",
  schema: CustomerListParamsSchema,
  handler: async (params) => customerService.listCustomers(params),
})

export const searchCustomersAction = defineAction({
  name: "searchCustomers",
  permission: "customer:view",
  schema: CustomerListParamsSchema.pick({ search: true }),
  handler: async ({ search }) => customerService.searchCustomers(search ?? ""),
})

export const createCustomer = defineAction({
  name: "createCustomer",
  permission: "customer:create",
  schema: CreateCustomerSchema,
  handler: async (input, { session }) => {
    const existing = await customerService.findCustomerByPhone(input.phone)
    if (existing) {
      throw new ActionFailure(
        `${existing.name} already exists with this phone number`,
        { phone: ["This phone number is already registered"] }
      )
    }

    const customer = await customerService.createCustomer(input, session.userId)

    await recordAudit({
      entity: "customers",
      entityId: customer.id,
      action: "create",
      summary: `Created customer ${customer.name}`,
      session,
    })

    revalidatePath("/admin/customers")
    return customer
  },
})

export const updateCustomer = defineAction({
  name: "updateCustomer",
  permission: "customer:update",
  schema: UpdateCustomerSchema,
  handler: async (input, { session }) => {
    const before = await customerService.getCustomer(input.id)
    if (!before) throw new ActionFailure("Customer not found")

    if (input.phone !== before.phone) {
      const clash = await customerService.findCustomerByPhone(input.phone)
      if (clash && clash.id !== input.id) {
        throw new ActionFailure("Another customer already uses this phone number", {
          phone: ["This phone number is already registered"],
        })
      }
    }

    const customer = await customerService.updateCustomer(input)
    if (!customer) throw new ActionFailure("Customer not found")

    await recordAudit({
      entity: "customers",
      entityId: customer.id,
      action: "update",
      summary: `Updated customer ${customer.name}`,
      changes: diffChanges(before, customer),
      session,
    })

    revalidatePath("/admin/customers")
    return customer
  },
})

export const deleteCustomer = defineAction({
  name: "deleteCustomer",
  permission: "customer:delete",
  schema: DeleteCustomerSchema,
  handler: async ({ id }, { session }) => {
    const before = await customerService.getCustomer(id)
    if (!before) throw new ActionFailure("Customer not found")

    const result = await customerService.softDeleteCustomer(id)
    if (!result.ok) throw new ActionFailure(result.reason)

    await recordAudit({
      entity: "customers",
      entityId: id,
      action: "delete",
      summary: `Deleted customer ${before.name}`,
      session,
    })

    revalidatePath("/admin/customers")
    return { id }
  },
})
