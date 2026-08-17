import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { actor, money, pk, softDelete, timestamps } from "./_shared"
import { bookings } from "./booking.schema"
import { customers } from "./customer.schema"
import { suppliers } from "./supplier.schema"
import { tripCostItems } from "./trip-cost.schema"
import { vehicles } from "./vehicle.schema"

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "cancelled",
])

export const paymentModeEnum = pgEnum("payment_mode", [
  "cash",
  "upi",
  "bank_transfer",
  "card",
  "cheque",
  "other",
])

/** Customer-facing invoice. Auto-created when a booking is confirmed. */
export const invoices = pgTable(
  "invoices",
  {
    id: pk(),
    /** e.g. FC/26-27/0001. */
    number: text("number").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),

    subtotal: money("subtotal").notNull().default(0),
    discount: money("discount").notNull().default(0),
    /** GST percentage x 100 (5% -> 500). */
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    taxAmount: money("tax_amount").notNull().default(0),
    total: money("total").notNull().default(0),
    /** Denormalised sum of receipts, kept in sync inside the payment service. */
    amountPaid: money("amount_paid").notNull().default(0),

    status: invoiceStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    terms: text("terms"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("invoices_number_key").on(t.number),
    index("invoices_booking_idx").on(t.bookingId),
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_status_idx").on(t.status),
    index("invoices_issue_date_idx").on(t.issueDate),
  ]
)

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: pk(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull().default(0),
    amount: money("amount").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId, t.sortOrder)]
)

/**
 * Money IN from a customer — the advance and the balance both land here.
 * Never mutate a receipt; void it with `voidedAt` and post a new one.
 */
export const receipts = pgTable(
  "receipts",
  {
    id: pk(),
    number: text("number").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    amount: money("amount").notNull(),
    mode: paymentModeEnum("mode").notNull().default("cash"),
    /** UTR / cheque no / UPI ref. */
    reference: text("reference"),
    receivedAt: date("received_at").notNull(),
    /** True for the booking advance, so "advance collected" reports are trivial. */
    isAdvance: boolean("is_advance").notNull().default(false),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    receivedBy: actor("received_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("receipts_number_key").on(t.number),
    index("receipts_booking_idx").on(t.bookingId),
    index("receipts_invoice_idx").on(t.invoiceId),
    index("receipts_received_at_idx").on(t.receivedAt),
  ]
)

/** Money OUT to a supplier, settling one or more trip cost lines. */
export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: pk(),
    number: text("number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    tripCostItemId: uuid("trip_cost_item_id").references(() => tripCostItems.id),
    amount: money("amount").notNull(),
    mode: paymentModeEnum("mode").notNull().default("bank_transfer"),
    reference: text("reference"),
    paidAt: date("paid_at").notNull(),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    paidBy: actor("paid_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_payments_number_key").on(t.number),
    index("supplier_payments_supplier_idx").on(t.supplierId),
    index("supplier_payments_booking_idx").on(t.bookingId),
    index("supplier_payments_paid_at_idx").on(t.paidAt),
  ]
)

/**
 * Direct expenses — both trip-linked (fuel on the road, driver bata) and
 * general overhead (office rent, salaries) when bookingId is null.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: pk(),
    number: text("number").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    categoryId: uuid("category_id"),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
    spentAt: date("spent_at").notNull(),
    mode: paymentModeEnum("mode").notNull().default("cash"),
    /** Receipt/bill photo. */
    billUrl: text("bill_url"),
    approvedBy: actor("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: actor("created_by"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("expenses_number_key").on(t.number),
    index("expenses_booking_idx").on(t.bookingId),
    index("expenses_vehicle_idx").on(t.vehicleId),
    index("expenses_category_idx").on(t.categoryId),
    index("expenses_spent_at_idx").on(t.spentAt),
  ]
)

/** User-editable expense buckets — "expense per category" in the client's notes. */
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: pk(),
    name: text("name").notNull(),
    /** true = counts against a trip's P&L, false = general overhead. */
    isTripRelated: boolean("is_trip_related").notNull().default(true),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("expense_categories_name_key").on(t.name)]
)

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceLine = typeof invoiceLines.$inferSelect
export type NewInvoiceLine = typeof invoiceLines.$inferInsert
export type Receipt = typeof receipts.$inferSelect
export type NewReceipt = typeof receipts.$inferInsert
export type SupplierPayment = typeof supplierPayments.$inferSelect
export type NewSupplierPayment = typeof supplierPayments.$inferInsert
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type ExpenseCategory = typeof expenseCategories.$inferSelect
export type NewExpenseCategory = typeof expenseCategories.$inferInsert
