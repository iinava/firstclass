"use server"

import { defineAction } from "@/lib/action"
import * as reports from "@/lib/services/report.service"
import { ReportParamsSchema } from "@/validations/accounts.validation"

export const fetchProfitLoss = defineAction({
  name: "fetchProfitLoss",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getProfitLoss(params),
})

export const fetchRevenueByTrip = defineAction({
  name: "fetchRevenueByTrip",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getRevenueByTrip(params),
})

export const fetchExpenseByCategory = defineAction({
  name: "fetchExpenseByCategory",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getExpenseByCategory(params),
})

export const fetchSupplierSpend = defineAction({
  name: "fetchSupplierSpend",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getSupplierSpend(params),
})

export const fetchVehicleExpense = defineAction({
  name: "fetchVehicleExpense",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getVehicleExpense(params),
})

export const fetchStaffPerformance = defineAction({
  name: "fetchStaffPerformance",
  permission: "report:view",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getStaffPerformance(params),
})

export const fetchMonthlyTrend = defineAction({
  name: "fetchMonthlyTrend",
  permission: "report:financial",
  schema: ReportParamsSchema,
  handler: async (params) => reports.getMonthlyTrend(params),
})
