"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionFailure, defineAction } from "@/lib/action"
import { recordAudit } from "@/lib/audit"
import {
  nextExpenseNumber,
  nextInvoiceNumber,
  nextReceiptNumber,
  nextSupplierPaymentNumber,
} from "@/lib/codes"
import { formatMoney } from "@/lib/money"
import * as accounts from "@/lib/services/accounts.service"
import * as bookingService from "@/lib/services/booking.service"
import { uuidSchema } from "@/validations/common.validation"
import {
  ApproveExpenseSchema,
  CancelInvoiceSchema,
  CreateInvoiceSchema,
  CreateReceiptSchema,
  CreateSupplierPaymentSchema,
  DeleteExpenseSchema,
  ExpenseCategorySchema,
  ExpenseFormSchema,
  ExpenseListParamsSchema,
  InvoiceListParamsSchema,
  ReceiptListParamsSchema,
  UpdateExpenseSchema,
  UpdateInvoiceStatusSchema,
  VoidReceiptSchema,
  VoidSupplierPaymentSchema,
} from "@/validations/accounts.validation"

// ------------------------------------------------------------------ invoices

export const fetchInvoices = defineAction({
  name: "fetchInvoices",
  permission: "invoice:view",
  schema: InvoiceListParamsSchema,
  handler: async (params) => accounts.listInvoices(params),
})

export const fetchInvoiceLines = defineAction({
  name: "fetchInvoiceLines",
  permission: "invoice:view",
  schema: z.object({ invoiceId: uuidSchema }),
  handler: async ({ invoiceId }) => accounts.listInvoiceLines(invoiceId),
})

/**
 * Generates the invoice from the booking's stored totals rather than re-asking
 * for amounts — the invoice can then never disagree with the trip it bills.
 */
export const createInvoice = defineAction({
  name: "createInvoice",
  permission: "invoice:create",
  schema: CreateInvoiceSchema,
  handler: async (input, { session }) => {
    const booking = await bookingService.getBookingRaw(input.bookingId)
    if (!booking) throw new ActionFailure("Booking not found")
    if (booking.status === "cancelled") {
      throw new ActionFailure("A cancelled booking cannot be invoiced")
    }

    const existing = await accounts.getInvoiceByBooking(input.bookingId)
    if (existing) {
      throw new ActionFailure(`Invoice ${existing.number} already exists for this trip`)
    }

    const number = await nextInvoiceNumber(new Date(input.issueDate))
    const paxLabel = `${booking.adults} adult${booking.adults === 1 ? "" : "s"}${
      booking.children ? `, ${booking.children} child${booking.children === 1 ? "" : "ren"}` : ""
    }`

    const invoice = await accounts.createInvoice(
      {
        number,
        bookingId: booking.id,
        customerId: booking.customerId,
        issueDate: input.issueDate,
        dueDate: input.dueDate || null,
        subtotal: booking.sellSubtotal,
        discount: booking.discount,
        taxRateBps: booking.taxRateBps,
        taxAmount: booking.taxAmount,
        total: booking.grandTotal,
        status: "sent",
        notes: input.notes,
        terms: input.terms,
        createdBy: session.userId,
      },
      [
        {
          description: `${booking.title}${booking.destination ? ` — ${booking.destination}` : ""} (${paxLabel})`,
          quantity: 1,
          unitPrice: booking.sellSubtotal,
          amount: booking.sellSubtotal,
          sortOrder: 0,
        },
      ]
    )

    // Receipts already taken as advance count against the new invoice.
    const priorReceipts = await accounts.listReceiptsByBooking(booking.id)
    const alreadyPaid = priorReceipts
      .filter((r) => !r.voidedAt)
      .reduce((sum, r) => sum + Number(r.amount), 0)
    if (alreadyPaid > 0) {
      await accounts.applyReceiptToInvoice(invoice.id, alreadyPaid)
    }

    await recordAudit({
      entity: "invoices",
      entityId: invoice.id,
      action: "create",
      summary: `Raised invoice ${number} for ${formatMoney(booking.grandTotal)}`,
      session,
    })

    revalidatePath("/admin/invoices")
    return invoice
  },
})

export const updateInvoiceStatus = defineAction({
  name: "updateInvoiceStatus",
  permission: "invoice:update",
  schema: UpdateInvoiceStatusSchema,
  handler: async ({ id, status }, { session }) => {
    const invoice = await accounts.updateInvoice(id, { status })
    if (!invoice) throw new ActionFailure("Invoice not found")
    await recordAudit({
      entity: "invoices",
      entityId: id,
      action: "status_change",
      summary: `Invoice ${invoice.number} marked ${status}`,
      session,
    })
    revalidatePath("/admin/invoices")
    return invoice
  },
})

export const cancelInvoice = defineAction({
  name: "cancelInvoice",
  permission: "invoice:cancel",
  schema: CancelInvoiceSchema,
  handler: async ({ id, reason }, { session }) => {
    const before = await accounts.getInvoice(id)
    if (!before) throw new ActionFailure("Invoice not found")
    if (Number(before.amountPaid) > 0) {
      throw new ActionFailure(
        "Payments exist against this invoice — void the receipts first"
      )
    }

    const invoice = await accounts.updateInvoice(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      notes: reason,
    })

    await recordAudit({
      entity: "invoices",
      entityId: id,
      action: "cancel",
      summary: `Cancelled invoice ${before.number} — ${reason}`,
      session,
    })
    revalidatePath("/admin/invoices")
    return invoice
  },
})

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

/** Records money in and keeps the linked invoice's paid total in step. */
export const createReceipt = defineAction({
  name: "createReceipt",
  permission: "payment:create",
  schema: CreateReceiptSchema,
  handler: async (input, { session }) => {
    const booking = await bookingService.getBookingRaw(input.bookingId)
    if (!booking) throw new ActionFailure("Booking not found")

    const ledger = await bookingService.getBookingLedger(input.bookingId)
    if (input.amount > ledger.balance) {
      throw new ActionFailure(
        `That is more than the outstanding balance of ${formatMoney(ledger.balance)}`,
        { amount: [`Balance due is ${formatMoney(ledger.balance)}`] }
      )
    }

    const number = await nextReceiptNumber(new Date(input.receivedAt))
    const invoice =
      input.invoiceId
        ? await accounts.getInvoice(input.invoiceId)
        : await accounts.getInvoiceByBooking(input.bookingId)

    const receipt = await accounts.createReceipt({
      number,
      bookingId: input.bookingId,
      invoiceId: invoice?.id ?? null,
      customerId: booking.customerId,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference,
      receivedAt: input.receivedAt,
      isAdvance: input.isAdvance,
      notes: input.notes,
      receivedBy: session.userId,
    })

    if (invoice) {
      await accounts.applyReceiptToInvoice(invoice.id, input.amount)
    }

    await recordAudit({
      entity: "receipts",
      entityId: receipt.id,
      action: "create",
      summary: `Received ${formatMoney(input.amount)} against ${booking.code}`,
      session,
    })

    revalidatePath("/admin/payments")
    revalidatePath(`/admin/bookings/${input.bookingId}`)
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
    // Reverse the invoice allocation rather than editing the original entry.
    if (before.invoiceId) {
      await accounts.applyReceiptToInvoice(before.invoiceId, -Number(before.amount))
    }

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
