import { z } from "zod"
import {
  dateStringSchema,
  moneySchema,
  optionalText,
  uuidSchema,
} from "./common.validation"
import { paymentModeSchema } from "./accounts.validation"

/** "2026-08" — the month being paid. */
export const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month")

export const PayrollPreviewSchema = z.object({ month: monthSchema })

export const PostPayrollSchema = z.object({
  month: monthSchema,
  /**
   * The net total the operator saw on screen, in paise. The server recomputes
   * and refuses if the figure has moved since — attendance edited in another tab
   * between looking and posting would otherwise pay a number nobody approved.
   */
  expectedNetTotal: z.coerce.number().int().min(0),
  notes: optionalText(500),
})

// ------------------------------------------------------------ salary advances

export const SalaryAdvanceListSchema = z.object({ month: monthSchema })

export const CreateSalaryAdvanceSchema = z.object({
  employeeId: uuidSchema,
  /** The month whose salary the advance is recovered from. */
  month: monthSchema,
  amount: moneySchema.refine((v) => v > 0, "Amount must be greater than zero"),
  givenOn: dateStringSchema,
  mode: paymentModeSchema.default("cash"),
  notes: optionalText(500),
})

export const DeleteSalaryAdvanceSchema = z.object({ id: uuidSchema })

export type PayrollPreviewInput = z.output<typeof PayrollPreviewSchema>
export type PostPayrollInput = z.output<typeof PostPayrollSchema>
export type SalaryAdvanceFormValues = z.input<typeof CreateSalaryAdvanceSchema>
