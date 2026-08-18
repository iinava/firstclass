/**
 * Central query key factory.
 *
 * Every key is built here so that invalidation is never a guessing game — if a
 * mutation touches leads, it invalidates `qk.leads.all` and every list/detail
 * key nested under it is refetched.
 */

export type ListParams = Record<string, unknown>

export const qk = {
  customers: {
    all: ["customers"] as const,
    list: (params: ListParams = {}) => ["customers", "list", params] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    search: (term: string) => ["customers", "search", term] as const,
  },
  leads: {
    all: ["leads"] as const,
    list: (params: ListParams = {}) => ["leads", "list", params] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
    stats: () => ["leads", "stats"] as const,
    activities: (id: string) => ["leads", "activities", id] as const,
  },
  followups: {
    all: ["followups"] as const,
    list: (params: ListParams = {}) => ["followups", "list", params] as const,
    queue: (params: ListParams = {}) => ["followups", "queue", params] as const,
    byLead: (leadId: string) => ["followups", "lead", leadId] as const,
    counts: () => ["followups", "counts"] as const,
  },
  itineraries: {
    all: ["itineraries"] as const,
    list: (params: ListParams = {}) => ["itineraries", "list", params] as const,
    detail: (id: string) => ["itineraries", "detail", id] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (params: ListParams = {}) => ["bookings", "list", params] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    costs: (id: string) => ["bookings", "costs", id] as const,
    ledger: (id: string) => ["bookings", "ledger", id] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (params: ListParams = {}) => ["suppliers", "list", params] as const,
    detail: (id: string) => ["suppliers", "detail", id] as const,
    options: () => ["suppliers", "options"] as const,
  },
  vehicles: {
    all: ["vehicles"] as const,
    list: (params: ListParams = {}) => ["vehicles", "list", params] as const,
    detail: (id: string) => ["vehicles", "detail", id] as const,
    availability: (params: ListParams = {}) =>
      ["vehicles", "availability", params] as const,
  },
  drivers: {
    all: ["drivers"] as const,
    list: (params: ListParams = {}) => ["drivers", "list", params] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    receipts: (params: ListParams = {}) => ["accounts", "receipts", params] as const,
    expenses: (params: ListParams = {}) => ["accounts", "expenses", params] as const,
    outstanding: (params: ListParams = {}) =>
      ["accounts", "outstanding", params] as const,
  },
  hrms: {
    all: ["hrms"] as const,
    employees: (params: ListParams = {}) => ["hrms", "employees", params] as const,
    employee: (id: string) => ["hrms", "employee", id] as const,
    attendance: (params: ListParams = {}) => ["hrms", "attendance", params] as const,
    leaves: (params: ListParams = {}) => ["hrms", "leaves", params] as const,
  },
  reports: {
    all: ["reports"] as const,
    dashboard: (params: ListParams = {}) => ["reports", "dashboard", params] as const,
    profitLoss: (params: ListParams = {}) => ["reports", "pl", params] as const,
    byCategory: (params: ListParams = {}) =>
      ["reports", "by-category", params] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params: ListParams = {}) => ["users", "list", params] as const,
    options: () => ["users", "options"] as const,
  },
} as const
