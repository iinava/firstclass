"use server"

import { revalidatePath } from "next/cache"
import { ActionFailure, defineAction } from "@/lib/action"
import { recordAudit } from "@/lib/audit"
import {
  nextExpenseNumber,
  nextReceiptNumber,
  nextSupplierPaymentNumber,
} from "@/lib/codes"
import { formatMoney } from "@/lib/money"
import * as accounts from "@/lib/services/accounts.service"
import * as bookingService from "@/lib/services/booking.service"
import { storage } from "@/lib/storage"
import {
  ApproveExpenseSchema,
  CreateReceiptSchema,
  CreateSupplierPaymentSchema,
  DeleteExpenseSchema,
  ExpenseCategorySchema,
  ExpenseFormSchema,
  ExpenseListParamsSchema,
  ReceiptListParamsSchema,
  UpdateExpenseSchema,
  VoidReceiptSchema,
  VoidSupplierPaymentSchema,
} from "@/validations/accounts.validation"

// ------------------------------------------------------------------ receipts

export const fetchReceipts = defineAction({
  name: "fetchReceipts",
  permission: "payment:view",
  schema: ReceiptListParamsSchema,
  handler: async (params) => accounts.listReceipts(params),
})

export const fetchOutstanding = defineAction({
  name: "fetchOutstanding",
  permission: "payment:view",
  handler: async (_input: void) => {
    const rows = await accounts.getOutstanding()
    return rows.map((r) => ({
      ...r,
      grandTotal: Number(r.grandTotal),
      received: Number(r.received),
      balance: Number(r.grandTotal) - Number(r.received),
    }))
  },
})

/** Records money received against a trip. */
export const createReceipt = defineAction({
  name: "createReceipt",
  permission: "payment:create",
  schema: CreateReceiptSchema,
  handler: async (input, { session }) => {
    const booking = await bookingService.getBookingRaw(input.bookingId)
    if (!booking) throw new ActionFailure("Trip not found")

    const number = await nextReceiptNumber(new Date(input.receivedAt))

    const result = await accounts.createReceiptAtomic(input.bookingId, input.amount, {
      number,
      bookingId: input.bookingId,
      customerId: booking.customerId,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference,
      receivedAt: input.receivedAt,
      isAdvance: input.isAdvance,
      notes: input.notes,
      receivedBy: session.userId,
    })
    if (!result.ok) {
      throw new ActionFailure(
        `Balance due on this trip is only ${formatMoney(result.balance)}`,
        { amount: [`Cannot exceed ${formatMoney(result.balance)}`] }
      )
    }
    const receipt = result.receipt

    await recordAudit({
      entity: "receipts",
      entityId: receipt.id,
      action: "create",
      summary: `Received ${formatMoney(input.amount)} against ${booking.code}`,
      session,
    })

    revalidatePath("/admin/payments")
    revalidatePath(`/admin/trips/${input.bookingId}`)
    return receipt
  },
})

export const voidReceipt = defineAction({
  name: "voidReceipt",
  permission: "payment:void",
  schema: VoidReceiptSchema,
  handler: async ({ id, reason }, { session }) => {
    const before = await accounts.getReceipt(id)
    if (!before) throw new ActionFailure("Receipt not found")
    if (before.voidedAt) throw new ActionFailure("This receipt is already void")

    const receipt = await accounts.voidReceipt(id, reason)

    await recordAudit({
      entity: "receipts",
      entityId: id,
      action: "void",
      summary: `Voided receipt ${before.number} — ${reason}`,
      session,
    })

    revalidatePath("/admin/payments")
    return receipt
  },
})

// --------------------------------------------------------- supplier payments

export const fetchSupplierPayments = defineAction({
  name: "fetchSupplierPayments",
  permission: "payment:view",
  schema: ReceiptListParamsSchema,
  handler: async (params) => accounts.listSupplierPayments(params),
})

export const createSupplierPayment = defineAction({
  name: "createSupplierPayment",
  permission: "payment:create",
  schema: CreateSupplierPaymentSchema,
  handler: async (input, { session }) => {
    const number = await nextSupplierPaymentNumber(new Date(input.paidAt))

    const payment = await accounts.createSupplierPayment({
      number,
      supplierId: input.supplierId,
      bookingId: input.bookingId ?? null,
      tripCostItemId: input.tripCostItemId ?? null,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference,
      paidAt: input.paidAt,
      notes: input.notes,
      paidBy: session.userId,
    })

    if (input.tripCostItemId) {
      await accounts.applyPaymentToCostItem(input.tripCostItemId, input.amount)
    }

    await recordAudit({
      entity: "supplier_payments",
      entityId: payment.id,
      action: "create",
      summary: `Paid ${formatMoney(input.amount)} to supplier`,
      session,
    })

    revalidatePath("/admin/payments")
    return payment
  },
})

/**
 * Deliberately refuses rather than mutating a settled payment. Reversing entries
 * keep the payables ledger append-only, which is what makes it auditable.
 */
export const voidSupplierPayment = defineAction({
  name: "voidSupplierPayment",
  permission: "payment:void",
  schema: VoidSupplierPaymentSchema,
  handler: async (_input): Promise<never> => {
    throw new ActionFailure(
      "Supplier payments cannot be voided — record a reversing payment instead"
    )
  },
})

// ------------------------------------------------------------------ expenses

export const fetchExpenses = defineAction({
  name: "fetchExpenses",
  permission: "expense:view",
  schema: ExpenseListParamsSchema,
  handler: async (params) => accounts.listExpenses(params),
})

export const fetchExpenseCategories = defineAction({
  name: "fetchExpenseCategories",
  permission: "expense:view",
  handler: async (_input: void) => accounts.listExpenseCategories(),
})

export const createExpense = defineAction({
  name: "createExpense",
  permission: "expense:create",
  schema: ExpenseFormSchema,
  handler: async (input, { session }) => {
    const number = await nextExpenseNumber(new Date(input.spentAt))
    const expense = await accounts.createExpense({
      number,
      ...input,
      bookingId: input.bookingId ?? null,
      vehicleId: input.vehicleId ?? null,
      categoryId: input.categoryId ?? null,
      createdBy: session.userId,
    })

    await recordAudit({
      entity: "expenses",
      entityId: expense.id,
      action: "create",
      summary: `Logged expense ${formatMoney(input.amount)}: ${input.description}`,
      session,
    })

    revalidatePath("/admin/expenses")
    return expense
  },
})

export const updateExpense = defineAction({
  name: "updateExpense",
  permission: "expense:update",
  schema: UpdateExpenseSchema,
  handler: async ({ id, ...input }, { session }) => {
    const before = await accounts.getExpense(id)
    if (!before) throw new ActionFailure("Expense not found")
    if (before.approvedAt) {
      throw new ActionFailure("An approved expense cannot be edited")
    }

    const expense = await accounts.updateExpense(id, {
      ...input,
      bookingId: input.bookingId ?? null,
      vehicleId: input.vehicleId ?? null,
      categoryId: input.categoryId ?? null,
    })

    // The bill was replaced or cleared. Best-effort unlink: the row is already
    // saved, so a failed delete is housekeeping, not a user-facing error.
    // (Deleting an expense is a soft delete, so those files are kept.)
    if (before.billUrl && before.billUrl !== expense?.billUrl) {
      try {
        await storage.delete(before.billUrl)
      } catch (error) {
        console.error("[expenses] could not remove bill", before.billUrl, error)
      }
    }

    await recordAudit({
      entity: "expenses",
      entityId: id,
      action: "update",
      summary: `Updated expense ${before.number}`,
      session,
    })
    revalidatePath("/admin/expenses")
    return expense
  },
})

export const approveExpense = defineAction({
  name: "approveExpense",
  permission: "expense:approve",
  schema: ApproveExpenseSchema,
  handler: async ({ id }, { session }) => {
    const expense = await accounts.updateExpense(id, {
      approvedBy: session.userId,
      approvedAt: new Date(),
    })
    if (!expense) throw new ActionFailure("Expense not found")

    await recordAudit({
      entity: "expenses",
      entityId: id,
      action: "approve",
      summary: `Approved expense ${expense.number}`,
      session,
    })
    revalidatePath("/admin/expenses")
    return expense
  },
})

export const deleteExpense = defineAction({
  name: "deleteExpense",
  permission: "expense:delete",
  schema: DeleteExpenseSchema,
  handler: async ({ id }, { session }) => {
    const before = await accounts.getExpense(id)
    if (!before) throw new ActionFailure("Expense not found")
    if (before.approvedAt) {
      throw new ActionFailure("An approved expense cannot be deleted")
    }

    await accounts.softDeleteExpense(id)
    await recordAudit({
      entity: "expenses",
      entityId: id,
      action: "delete",
      summary: `Deleted expense ${before.number}`,
      session,
    })
    revalidatePath("/admin/expenses")
    return { id }
  },
})

export const createExpenseCategory = defineAction({
  name: "createExpenseCategory",
  permission: "expense:create",
  schema: ExpenseCategorySchema,
  handler: async (input) => {
    const category = await accounts.createExpenseCategory(input)
    revalidatePath("/admin/expenses")
    return category
  },
})
