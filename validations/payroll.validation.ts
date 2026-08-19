import { z } from "zod"
import { optionalText } from "./common.validation"

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

export type PayrollPreviewInput = z.output<typeof PayrollPreviewSchema>
export type PostPayrollInput = z.output<typeof PostPayrollSchema>
