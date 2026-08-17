"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, defineAction } from "@/lib/action"
import { diffChanges, recordAudit } from "@/lib/audit"
import * as service from "@/lib/services/supplier.service"
import { uuidSchema } from "@/validations/common.validation"
import {
  CreateSupplierSchema,
  DeleteSupplierRateSchema,
  DeleteSupplierSchema,
  SupplierListParamsSchema,
  SupplierRateFormSchema,
  UpdateSupplierRateSchema,
  UpdateSupplierSchema,
  supplierTypeSchema,
} from "@/validations/supplier.validation"

export const fetchSuppliers = defineAction({
  name: "fetchSuppliers",
  permission: "supplier:view",
  schema: SupplierListParamsSchema,
  handler: async (params) => service.listSuppliers(params),
})

export const fetchSupplierOptions = defineAction({
  name: "fetchSupplierOptions",
  permission: "supplier:view",
  schema: z.object({ type: supplierTypeSchema.optional() }),
  handler: async ({ type }) => service.getSupplierOptions(type),
})

export const fetchSupplierRates = defineAction({
  name: "fetchSupplierRates",
  permission: "supplier:view",
  schema: z.object({ supplierId: uuidSchema }),
  handler: async ({ supplierId }) => service.listSupplierRates(supplierId),
})

export const createSupplier = defineAction({
  name: "createSupplier",
  permission: "supplier:create",
  schema: CreateSupplierSchema,
  handler: async (input, { session }) => {
    const supplier = await service.createSupplier({
      ...input,
      createdBy: session.userId,
    })
    await recordAudit({
      entity: "suppliers",
      entityId: supplier.id,
      action: "create",
      summary: `Added supplier ${supplier.name}`,
      session,
    })
    revalidatePath("/admin/suppliers")
    return supplier
  },
})

export const updateSupplier = defineAction({
  name: "updateSupplier",
  permission: "supplier:update",
  schema: UpdateSupplierSchema,
  handler: async ({ id, ...values }, { session }) => {
    const before = await service.getSupplier(id)
    if (!before) throw new ActionFailure("Supplier not found")

    const supplier = await service.updateSupplier(id, values)
    if (!supplier) throw new ActionFailure("Supplier not found")

    await recordAudit({
      entity: "suppliers",
      entityId: id,
      action: "update",
      summary: `Updated supplier ${supplier.name}`,
      changes: diffChanges(before, supplier),
      session,
    })
    revalidatePath("/admin/suppliers")
    return supplier
  },
})

export const deleteSupplier = defineAction({
  name: "deleteSupplier",
  permission: "supplier:delete",
  schema: DeleteSupplierSchema,
  handler: async ({ id }, { session }) => {
    const before = await service.getSupplier(id)
    if (!before) throw new ActionFailure("Supplier not found")

    const result = await service.softDeleteSupplier(id)
    if (!result.ok) throw new ActionFailure(result.reason)

    await recordAudit({
      entity: "suppliers",
      entityId: id,
      action: "delete",
      summary: `Deleted supplier ${before.name}`,
      session,
    })
    revalidatePath("/admin/suppliers")
    return { id }
  },
})

export const createSupplierRate = defineAction({
  name: "createSupplierRate",
  permission: "supplier:update",
  schema: SupplierRateFormSchema,
  handler: async (input) => {
    const rate = await service.createSupplierRate(input)
    revalidatePath("/admin/suppliers")
    return rate
  },
})

export const updateSupplierRate = defineAction({
  name: "updateSupplierRate",
  permission: "supplier:update",
  schema: UpdateSupplierRateSchema,
  handler: async ({ id, ...values }) => {
    const rate = await service.updateSupplierRate(id, values)
    if (!rate) throw new ActionFailure("Rate not found")
    revalidatePath("/admin/suppliers")
    return rate
  },
})

export const deleteSupplierRate = defineAction({
  name: "deleteSupplierRate",
  permission: "supplier:update",
  schema: DeleteSupplierRateSchema,
  handler: async ({ id }) => {
    await service.deleteSupplierRate(id)
    revalidatePath("/admin/suppliers")
    return { id }
  },
})
