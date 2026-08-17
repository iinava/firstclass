import { z } from "zod"
import {
  dateStringSchema,
  listParamsSchema,
  moneySchema,
  optionalMoneySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "./common.validation"

export const PAYMENT_MODES = [
  "cash",
  "upi",
  "bank_transfer",
  "card",
  "cheque",
  "other",
] as const

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "cancelled",
] as const

export const paymentModeSchema = z.enum(PAYMENT_MODES)
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES)

export const PAYMENT_MODE_LABELS: Record<(typeof PAYMENT_MODES)[number], string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
}

export const INVOICE_STATUS_LABELS: Record<(typeof INVOICE_STATUSES)[number], string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  cancelled: "Cancelled",
}

// ------------------------------------------------------------------ invoices

/** Invoices are generated from a booking, so the form is intentionally thin. */
export const CreateInvoiceSchema = z.object({
  bookingId: uuidSchema,
  issueDate: dateStringSchema,
  dueDate: z.string().optional().nullable(),
  notes: optionalText(1000),
  terms: optionalText(2000),
})

export const UpdateInvoiceStatusSchema = z.object({
  id: uuidSchema,
  status: invoiceStatusSchema,
})

export const CancelInvoiceSchema = z.object({
  id: uuidSchema,
  reason: requiredText("Reason", 300),
})

export const InvoiceListParamsSchema = listParamsSchema.extend({
  status: invoiceStatusSchema.optional(),
  customerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ------------------------------------------------------------------ receipts

export const CreateReceiptSchema = z.object({
  bookingId: uuidSchema,
  invoiceId: uuidSchema.nullable().optional(),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  mode: paymentModeSchema.default("cash"),
  reference: optionalText(120),
  receivedAt: dateStringSchema,
  isAdvance: z.boolean().default(false),
  notes: optionalText(500),
})

export const VoidReceiptSchema = z.object({
  id: uuidSchema,
  reason: requiredText("Reason", 300),
})

export const ReceiptListParamsSchema = listParamsSchema.extend({
  mode: paymentModeSchema.optional(),
  bookingId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// --------------------------------------------------------- supplier payments

export const CreateSupplierPaymentSchema = z.object({
  supplierId: uuidSchema,
  bookingId: uuidSchema.nullable().optional(),
  tripCostItemId: uuidSchema.nullable().optional(),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  mode: paymentModeSchema.default("bank_transfer"),
  reference: optionalText(120),
  paidAt: dateStringSchema,
  notes: optionalText(500),
})

export const VoidSupplierPaymentSchema = z.object({
  id: uuidSchema,
  reason: requiredText("Reason", 300),
})

// ------------------------------------------------------------------ expenses

export const ExpenseFormSchema = z.object({
  bookingId: uuidSchema.nullable().optional(),
  vehicleId: uuidSchema.nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  description: requiredText("Description", 300),
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  spentAt: dateStringSchema,
  mode: paymentModeSchema.default("cash"),
  billUrl: optionalText(500),
  notes: optionalText(500),
})

export const UpdateExpenseSchema = ExpenseFormSchema.extend({ id: uuidSchema })
export const DeleteExpenseSchema = z.object({ id: uuidSchema })
export const ApproveExpenseSchema = z.object({ id: uuidSchema })

export const ExpenseListParamsSchema = listParamsSchema.extend({
  categoryId: z.string().optional(),
  bookingId: z.string().optional(),
  vehicleId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const ExpenseCategorySchema = z.object({
  name: requiredText("Name", 80),
  isTripRelated: z.boolean().default(true),
  description: optionalText(300),
})

export const UpdateExpenseCategorySchema = ExpenseCategorySchema.extend({
  id: uuidSchema,
})

// ------------------------------------------------------------------- reports

export const ReportParamsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(["trip", "category", "supplier", "staff", "month"]).default("trip"),
})

export type CreateReceiptValues = z.input<typeof CreateReceiptSchema>
export type CreateInvoiceValues = z.input<typeof CreateInvoiceSchema>
export type ExpenseFormValues = z.input<typeof ExpenseFormSchema>
export type SupplierPaymentValues = z.input<typeof CreateSupplierPaymentSchema>
export type InvoiceListParams = z.output<typeof InvoiceListParamsSchema>
export type ExpenseListParams = z.output<typeof ExpenseListParamsSchema>
export type ReceiptListParams = z.output<typeof ReceiptListParamsSchema>
export type ReportParams = z.output<typeof ReportParamsSchema>
export { optionalMoneySchema }
