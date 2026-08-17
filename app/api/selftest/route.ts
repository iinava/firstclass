/**
 * End-to-end operations harness — `pnpm test:ops`.
 *
 * Server actions only work inside a request, so the suite runs as a route
 * handler rather than a plain script: `cookies()`, `revalidatePath()` and the
 * permission gate all behave exactly as they do for a real click in the UI.
 * Every module's create → read → update → delete path is exercised against the
 * real database, along with the guards that are supposed to refuse.
 *
 * Development only, and every row it creates is removed on the way out.
 */
import { NextResponse } from "next/server"
import { inArray } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { auditLogs } from "@/db/schemas/system.schema"
import { bookings, bookingPax } from "@/db/schemas/booking.schema"
import {
  expenses,
  expenseCategories,
  invoiceLines,
  invoices,
  receipts,
  supplierPayments,
} from "@/db/schemas/accounts.schema"
import { customers } from "@/db/schemas/customer.schema"
import { attendance, employees, leaveRequests } from "@/db/schemas/hrms.schema"
import {
  itineraries,
  itineraryDays,
  itineraryImages,
} from "@/db/schemas/itinerary.schema"
import { leadActivities, leadFollowups, leads } from "@/db/schemas/lead.schema"
import { supplierRates, suppliers } from "@/db/schemas/supplier.schema"
import { tripCostItems } from "@/db/schemas/trip-cost.schema"
import { users } from "@/db/schemas/user.schema"
import { drivers, vehicleAssignments, vehicles } from "@/db/schemas/vehicle.schema"
import type { ActionResult } from "@/lib/action"
import { getSession } from "@/lib/session"

import * as customerActionsRaw from "@/app/admin/customers/actions"
import * as leadActionsRaw from "@/app/admin/leads/actions"
import * as supplierActionsRaw from "@/app/admin/suppliers/actions"
import * as fleetActionsRaw from "@/app/admin/fleet/actions"
import * as packageActionsRaw from "@/app/admin/packages/actions"
import * as bookingActionsRaw from "@/app/admin/bookings/actions"
import * as accountActionsRaw from "@/app/admin/accounts-actions"
import * as employeeActionsRaw from "@/app/admin/employees/actions"
import * as reportActionsRaw from "@/app/admin/reports/actions"
import * as userActionsRaw from "@/app/admin/users/actions"

export const dynamic = "force-dynamic"

/**
 * Actions are typed with their schema's *output* — post-coercion, rupees
 * already turned into paise — but what actually reaches them at runtime is the
 * raw form object, which the server-side `safeParse` then coerces. The forms
 * paper over the gap with casts at each call site; the harness does it once
 * here, because feeding real form-shaped input is exactly what it is testing.
 */
type Loose<M> = {
  [K in keyof M]: M[K] extends (input: never) => Promise<infer R>
    ? (input?: unknown) => Promise<R>
    : M[K]
}
const loose = <M,>(actions: M) => actions as Loose<M>

const customerActions = loose(customerActionsRaw)
const leadActions = loose(leadActionsRaw)
const supplierActions = loose(supplierActionsRaw)
const fleetActions = loose(fleetActionsRaw)
const packageActions = loose(packageActionsRaw)
const bookingActions = loose(bookingActionsRaw)
const accountActions = loose(accountActionsRaw)
const employeeActions = loose(employeeActionsRaw)
const reportActions = loose(reportActionsRaw)
const userActions = loose(userActionsRaw)

interface Row {
  name: string
  ok: boolean
  detail?: string
}

/**
 * Ids created during a run, hard-deleted in FK-safe order at the end.
 *
 * Built fresh per request — module scope survives between requests in a warm
 * dev server, and a stale id would make the next run try to delete a row that
 * is already gone.
 */
const emptyBin = () => ({
  customer: [] as string[],
  lead: [] as string[],
  followup: [] as string[],
  supplier: [] as string[],
  rate: [] as string[],
  driver: [] as string[],
  vehicle: [] as string[],
  assignment: [] as string[],
  itinerary: [] as string[],
  day: [] as string[],
  image: [] as string[],
  booking: [] as string[],
  pax: [] as string[],
  cost: [] as string[],
  invoice: [] as string[],
  receipt: [] as string[],
  supplierPayment: [] as string[],
  expense: [] as string[],
  category: [] as string[],
  employee: [] as string[],
  leave: [] as string[],
  user: [] as string[],
})

const TAG = "ZZT"

const today = new Date()
const iso = (offsetDays = 0) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  // Doubly gated: absent from any production build, and it still writes to the
  // real database in development, so a stray browser tab must not trigger it.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 })
  }
  const caller = await getSession()
  if (!caller) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  }

  const results: Row[] = []
  const only = new URL(request.url).searchParams.get("only")
  const bin = emptyBin()

  // 9777-8xxxx numbers are reserved for the harness so cleanup can be exact.
  let phoneSeq = 0
  const phone = () => `97778${String(++phoneSeq).padStart(5, "0")}`

  const pass = (name: string, detail?: string) =>
    results.push({ name, ok: true, detail })
  const fail = (name: string, detail?: string) =>
    results.push({ name, ok: false, detail })

  const expect = (name: string, cond: boolean, detail?: string) =>
    cond ? pass(name) : fail(name, detail)

  const why = (result: Extract<ActionResult<unknown>, { ok: false }>) =>
    result.fieldErrors
      ? `${result.error} — ${JSON.stringify(result.fieldErrors)}`
      : result.error

  /** Asserts the action succeeded and hands back its payload. */
  function must<T>(name: string, result: ActionResult<T>): T {
    if (!result.ok) {
      fail(name, why(result))
      throw new Error(`${name}: ${why(result)}`)
    }
    pass(name)
    return result.data
  }

  /** Asserts a guard refused, optionally checking the message. */
  function mustFail(name: string, result: ActionResult<unknown>, contains?: string) {
    if (result.ok) return fail(name, "expected a refusal, got success")
    if (contains && !result.error.toLowerCase().includes(contains.toLowerCase())) {
      return fail(name, `wrong message: ${why(result)}`)
    }
    pass(name)
  }

  /** A module. One throw aborts that module only, so the rest still runs. */
  async function section(title: string, fn: () => Promise<void>) {
    if (only && only !== title) return
    results.push({ name: `— ${title} —`, ok: true })
    try {
      await fn()
    } catch (error) {
      fail(`${title} aborted`, (error as Error).message)
    }
  }

  // Shared fixtures, populated as the sections run.
  let customerId = ""
  let supplierId = ""
  let vehicleId = ""
  let driverId = ""
  let bookingId = ""
  let itineraryId = ""
  let costId = ""
  let employeeId = ""

  // ------------------------------------------------------------------ users

  await section("users", async () => {
    const created = must(
      "createUser",
      await userActions.createUser({
        username: `${TAG.toLowerCase()}.sales`,
        password: "Testpass1",
        name: `${TAG} Sales`,
        email: "zzt.sales@example.com",
        phone: phone(),
        role: "sales",
        isActive: true,
      })
    )
    bin.user.push(created.id)

    mustFail(
      "duplicate username is rejected",
      await userActions.createUser({
        username: `${TAG.toLowerCase()}.sales`,
        password: "Testpass1",
        role: "staff",
        isActive: true,
      }),
      "taken"
    )

    mustFail(
      "weak password is rejected",
      await userActions.createUser({
        username: `${TAG.toLowerCase()}.weak`,
        password: "short",
        role: "staff",
        isActive: true,
      })
    )

    const list = must(
      "fetchUsers",
      await userActions.fetchUsers({ page: 1, pageSize: 25, sortDir: "desc" } as never)
    )
    expect(
      "new user appears in the list",
      list.rows.some((r) => r.id === created.id)
    )

    const filtered = must(
      "fetchUsers filtered by role",
      await userActions.fetchUsers({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        role: "sales",
      } as never)
    )
    expect(
      "role filter only returns that role",
      filtered.rows.every((r) => r.role === "sales")
    )

    must(
      "updateUser",
      await userActions.updateUser({
        id: created.id,
        name: `${TAG} Sales Renamed`,
        email: "zzt.sales@example.com",
        phone: phone(),
        role: "sales",
        isActive: true,
      })
    )

    must(
      "resetPassword",
      await userActions.resetPassword({ id: created.id, password: "Newpass123" })
    )

    must("deactivateUser", await userActions.deactivateUser({ id: created.id }))
  })

  // -------------------------------------------------------------- customers

  await section("customers", async () => {
    const dupePhone = phone()
    const created = must(
      "createCustomer",
      await customerActions.createCustomer({
        name: `${TAG} Anita Menon`,
        phone: dupePhone,
        email: "anita@example.com",
        city: "Kochi",
        state: "Kerala",
        source: "referral",
      })
    )
    customerId = created.id
    bin.customer.push(created.id)

    mustFail(
      "duplicate phone is rejected",
      await customerActions.createCustomer({
        name: `${TAG} Impostor`,
        phone: dupePhone,
        source: "walk_in",
      }),
      "already exists"
    )

    mustFail(
      "malformed phone is rejected",
      await customerActions.createCustomer({
        name: `${TAG} Bad Phone`,
        phone: "12345",
        source: "walk_in",
      })
    )

    const searched = must(
      "fetchCustomers with search",
      await customerActions.fetchCustomers({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        search: "Anita Menon",
      } as never)
    )
    expect(
      "search finds the customer",
      searched.rows.some((r) => r.id === created.id),
      `got ${searched.rows.length} rows`
    )

    const bySource = must(
      "fetchCustomers filtered by source",
      await customerActions.fetchCustomers({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        source: "referral",
      } as never)
    )
    expect(
      "source filter holds",
      bySource.rows.every((r) => r.source === "referral")
    )

    // Compared as reverse of each other rather than against a JS comparator:
    // Postgres orders by its own collation, which disagrees with localeCompare
    // on case, and it is the database's ordering that the UI shows.
    const asc = must(
      "fetchCustomers sorted by name ascending",
      await customerActions.fetchCustomers({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortDir: "asc",
      } as never)
    )
    const desc = must(
      "fetchCustomers sorted by name descending",
      await customerActions.fetchCustomers({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortDir: "desc",
      } as never)
    )
    const ascNames = asc.rows.map((r) => r.name)
    const descNames = desc.rows.map((r) => r.name)
    expect(
      "sort direction reverses the order",
      ascNames.length > 1 &&
        ascNames.length === descNames.length &&
        ascNames.every((name, i) => name === descNames[descNames.length - 1 - i]),
      `${ascNames[0]} … vs … ${descNames[0]}`
    )

    const paged = must(
      "fetchCustomers page 1 of size 1",
      await customerActions.fetchCustomers({
        page: 1,
        pageSize: 1,
        sortDir: "desc",
      } as never)
    )
    expect("page size is respected", paged.rows.length <= 1)
    expect(
      "pageCount is derived from total",
      paged.pageCount === Math.ceil(paged.total / paged.pageSize),
      `${paged.pageCount} vs ${paged.total}/${paged.pageSize}`
    )

    must("searchCustomersAction", await customerActions.searchCustomersAction({ search: "Anita" }))

    const updated = must(
      "updateCustomer",
      await customerActions.updateCustomer({
        id: created.id,
        name: `${TAG} Anita Menon`,
        phone: dupePhone,
        city: "Thrissur",
        source: "referral",
      })
    )
    expect("update persisted the change", updated.city === "Thrissur", updated.city ?? "null")

    mustFail("updating a missing customer fails", await customerActions.updateCustomer({
      id: "00000000-0000-0000-0000-000000000000",
      name: "Ghost",
      phone: phone(),
      source: "walk_in",
    }), "not found")
  })

  // ------------------------------------------------------------- suppliers

  await section("suppliers", async () => {
    const created = must(
      "createSupplier",
      await supplierActions.createSupplier({
        name: `${TAG} Backwater Resort`,
        type: "resort",
        contactPerson: "Rajan",
        phone: phone(),
        city: "Alappuzha",
        rating: 4,
        isActive: true,
      })
    )
    supplierId = created.id
    bin.supplier.push(created.id)

    const list = must(
      "fetchSuppliers filtered by type",
      await supplierActions.fetchSuppliers({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        type: "resort",
      } as never)
    )
    expect("type filter holds", list.rows.every((r) => r.type === "resort"))

    const active = must(
      "fetchSuppliers filtered by isActive",
      await supplierActions.fetchSuppliers({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        isActive: "true",
      } as never)
    )
    expect("isActive filter holds", active.rows.every((r) => r.isActive))

    must("fetchSupplierOptions", await supplierActions.fetchSupplierOptions({ type: "resort" }))

    must(
      "updateSupplier",
      await supplierActions.updateSupplier({
        id: created.id,
        name: `${TAG} Backwater Resort & Spa`,
        type: "resort",
        rating: 5,
        isActive: true,
      })
    )

    const rate = must(
      "createSupplierRate",
      await supplierActions.createSupplierRate({
        supplierId: created.id,
        title: "Deluxe room",
        unit: "per night",
        rate: "6400",
        validFrom: iso(0),
        validTo: iso(180),
      })
    )
    bin.rate.push(rate.id)
    expect("rupees are stored as paise", Number(rate.rate) === 640000, String(rate.rate))

    const rates = must(
      "fetchSupplierRates",
      await supplierActions.fetchSupplierRates({ supplierId: created.id })
    )
    expect("rate card lists the new rate", rates.some((r) => r.id === rate.id))

    must(
      "updateSupplierRate",
      await supplierActions.updateSupplierRate({
        id: rate.id,
        supplierId: created.id,
        title: "Deluxe room (peak)",
        unit: "per night",
        rate: "7200",
      })
    )

    must("deleteSupplierRate", await supplierActions.deleteSupplierRate({ id: rate.id }))
  })

  // ----------------------------------------------------------------- fleet

  await section("fleet", async () => {
    const driver = must(
      "createDriver",
      await fleetActions.createDriver({
        name: `${TAG} Suresh`,
        phone: phone(),
        licenseNumber: "KL0720230001",
        licenseExpiry: iso(400),
        dailyAllowance: "800",
        isActive: true,
      })
    )
    driverId = driver.id
    bin.driver.push(driver.id)

    must(
      "updateDriver",
      await fleetActions.updateDriver({
        id: driver.id,
        name: `${TAG} Suresh Kumar`,
        phone: phone(),
        isActive: true,
      })
    )

    const vehicle = must(
      "createVehicle",
      await fleetActions.createVehicle({
        regNumber: "kl 07 zz 0001",
        type: "tempo_traveller",
        make: "Force",
        model: "Traveller 3350",
        seatingCapacity: 12,
        ownership: "owned",
        defaultDriverId: driver.id,
        ratePerKm: "22",
        insuranceExpiry: iso(300),
        isActive: true,
      })
    )
    vehicleId = vehicle.id
    bin.vehicle.push(vehicle.id)
    expect(
      "registration is normalised to uppercase, no spaces",
      vehicle.regNumber === "KL07ZZ0001",
      vehicle.regNumber
    )

    mustFail(
      "duplicate registration is rejected",
      await fleetActions.createVehicle({
        regNumber: "KL07ZZ0001",
        type: "suv",
        seatingCapacity: 7,
        ownership: "owned",
        isActive: true,
      }),
      "already exists"
    )

    const list = must(
      "fetchVehicles filtered by type",
      await fleetActions.fetchVehicles({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        type: "tempo_traveller",
      } as never)
    )
    expect("vehicle type filter holds", list.rows.every((r) => r.type === "tempo_traveller"))

    must("fetchVehicleOptions", await fleetActions.fetchVehicleOptions())
    must("fetchDrivers", await fleetActions.fetchDrivers({ search: TAG }))

    must(
      "updateVehicle",
      await fleetActions.updateVehicle({
        id: vehicle.id,
        regNumber: "KL07ZZ0001",
        type: "tempo_traveller",
        seatingCapacity: 14,
        ownership: "owned",
        isActive: true,
      })
    )
  })

  // -------------------------------------------------------------- packages

  await section("packages", async () => {
    const itinerary = must(
      "createItinerary",
      await packageActions.createItinerary({
        kind: "package",
        title: `${TAG} Munnar & Alleppey 4N/5D`,
        destination: "Munnar, Alleppey",
        durationDays: 5,
        durationNights: 4,
        summary: "Tea gardens, a houseboat night and a lazy backwater morning.",
        pricingMode: "per_pax",
        pricePerAdult: "18500",
        pricePerChild: "9000",
        inclusions: ["Accommodation", "Breakfast", "Private cab"],
        exclusions: ["Airfare", "Entry tickets"],
        validUntil: iso(90),
      })
    )
    itineraryId = itinerary.id
    bin.itinerary.push(itinerary.id)

    const day = must(
      "saveDay",
      await packageActions.saveDay({
        itineraryId: itinerary.id,
        dayNumber: 1,
        title: "Kochi → Munnar",
        description: "Drive up through the tea estates, evening at leisure.",
        breakfast: false,
        lunch: true,
        dinner: true,
      })
    )
    bin.day.push(day.id)

    must(
      "updateDay",
      await packageActions.updateDay({
        id: day.id,
        itineraryId: itinerary.id,
        dayNumber: 1,
        title: "Kochi → Munnar (via Cheeyappara)",
        breakfast: true,
        lunch: true,
        dinner: true,
      })
    )

    const image = must(
      "addImage",
      await packageActions.addImage({
        itineraryId: itinerary.id,
        url: "https://example.com/munnar.jpg",
        caption: "Tea gardens",
        sortOrder: 0,
      })
    )
    bin.image.push(image.id)

    mustFail(
      "a malformed image URL is rejected",
      await packageActions.addImage({
        itineraryId: itinerary.id,
        url: "not-a-url",
        sortOrder: 0,
      })
    )

    must("deleteImage", await packageActions.deleteImage({ id: image.id }))

    const detail = must(
      "fetchItineraryDetail",
      await packageActions.fetchItineraryDetail({ id: itinerary.id })
    )
    expect("detail carries the day", detail.days.length === 1, `${detail.days.length} days`)

    must(
      "updateItinerary",
      await packageActions.updateItinerary({
        id: itinerary.id,
        kind: "package",
        title: `${TAG} Munnar & Alleppey 4N/5D`,
        durationDays: 5,
        durationNights: 4,
        pricingMode: "per_pax",
        pricePerAdult: "19500",
        inclusions: ["Accommodation", "Breakfast"],
        exclusions: [],
      })
    )

    must(
      "updateItineraryStatus → published",
      await packageActions.updateItineraryStatus({ id: itinerary.id, status: "published" })
    )

    const shared = must(
      "toggleShare on",
      await packageActions.toggleShare({ id: itinerary.id, isShareEnabled: true })
    )
    expect("sharing yields a token", Boolean(shared.shareToken), "no token")

    const rotated = must(
      "regenerateShareToken",
      await packageActions.regenerateShareToken({ id: itinerary.id })
    )
    expect(
      "regenerating changes the token",
      rotated.shareToken !== shared.shareToken,
      "token unchanged"
    )

    const clone = must(
      "cloneItinerary",
      await packageActions.cloneItinerary({
        sourceId: itinerary.id,
        customerId: customerId || null,
        title: `${TAG} Munnar quote — Anita`,
      })
    )
    bin.itinerary.push(clone.id)
    const cloneDetail = must(
      "clone detail",
      await packageActions.fetchItineraryDetail({ id: clone.id })
    )
    expect("clone copies the days", cloneDetail.days.length === 1, `${cloneDetail.days.length}`)
    expect("clone is a custom quote", cloneDetail.itinerary.kind === "custom")

    const list = must(
      "fetchItineraries filtered by kind",
      await packageActions.fetchItineraries({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        kind: "custom",
      } as never)
    )
    expect("kind filter holds", list.rows.every((r) => r.kind === "custom"))

    must("deleteDay", await packageActions.deleteDay({ id: day.id }))
    must("deleteItinerary (clone)", await packageActions.deleteItinerary({ id: clone.id }))
  })

  // ----------------------------------------------------------------- leads

  await section("leads", async () => {
    const lead = must(
      "createLead",
      await leadActions.createLead({
        customerName: `${TAG} Vinod Nair`,
        customerPhone: phone(),
        destination: "Wayanad",
        travelDate: iso(45),
        durationDays: 3,
        adults: 4,
        children: 2,
        budget: "60000",
        status: "new",
        priority: "high",
        source: "instagram",
        requirements: "Two rooms, prefers a resort with a pool.",
        followupAt: `${iso(1)}T10:00`,
        followupNote: "Send the Wayanad options",
      })
    )
    bin.lead.push(lead.id)
    if (lead.customerId) bin.customer.push(lead.customerId)
    expect("lead gets a code", Boolean(lead.code), "no code")

    const stats = must("fetchLeadStats", await leadActions.fetchLeadStats())
    expect("stats return counts", typeof stats.total === "number")

    must("fetchAssignableUsers", await leadActions.fetchAssignableUsers())

    const byStatus = must(
      "fetchLeads filtered by status",
      await leadActions.fetchLeads({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        status: "new",
      } as never)
    )
    expect("status filter holds", byStatus.rows.every((r) => r.status === "new"))

    const byPriority = must(
      "fetchLeads filtered by priority",
      await leadActions.fetchLeads({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        priority: "high",
      } as never)
    )
    expect("priority filter holds", byPriority.rows.every((r) => r.priority === "high"))

    must(
      "updateLead",
      await leadActions.updateLead({
        id: lead.id,
        destination: "Wayanad & Coorg",
        adults: 4,
        children: 2,
        budget: "72000",
        priority: "high",
        source: "instagram",
      })
    )

    mustFail(
      "marking a lead lost needs a reason",
      await leadActions.updateLeadStatus({ id: lead.id, status: "lost" })
    )

    must(
      "updateLeadStatus → quoted",
      await leadActions.updateLeadStatus({ id: lead.id, status: "quoted" })
    )

    must("assignLead", await leadActions.assignLead({ id: lead.id, assignedTo: null }))

    const activities = must(
      "fetchLeadActivities",
      await leadActions.fetchLeadActivities({ leadId: lead.id })
    )
    expect("status change is logged as an activity", activities.length > 0)

    // ------------------------------------------------------------ follow-ups

    const followup = must(
      "createFollowup",
      await leadActions.createFollowup({
        leadId: lead.id,
        dueAt: `${iso(2)}T11:30`,
        channel: "whatsapp",
        note: "Share the revised quote",
      })
    )
    bin.followup.push(followup.id)

    must("fetchFollowupCounts", await leadActions.fetchFollowupCounts())
    must(
      "fetchFollowups (upcoming)",
      await leadActions.fetchFollowups({
        page: 1,
        pageSize: 25,
        sortDir: "asc",
        bucket: "upcoming",
      } as never)
    )
    const byLead = must(
      "fetchFollowupsByLead",
      await leadActions.fetchFollowupsByLead({ leadId: lead.id })
    )
    expect("both follow-ups are listed", byLead.length >= 2, `${byLead.length}`)

    must(
      "updateFollowup",
      await leadActions.updateFollowup({
        id: followup.id,
        dueAt: `${iso(3)}T09:00`,
        channel: "call",
        note: "Call after the quote lands",
      })
    )

    must(
      "completeFollowup with a chained next one",
      await leadActions.completeFollowup({
        id: followup.id,
        outcome: "Spoke to Vinod, sending the Coorg extension.",
        nextDueAt: `${iso(5)}T10:00`,
        nextNote: "Confirm the extension",
        nextStatus: "negotiating",
      })
    )

    const after = must(
      "follow-ups after completion",
      await leadActions.fetchFollowupsByLead({ leadId: lead.id })
    )
    const done = after.find((f) => f.id === followup.id)
    expect("completed follow-up is marked done", done?.status === "done", done?.status)
    expect(
      "the chained follow-up was created",
      after.some((f) => f.status === "pending" && f.note === "Confirm the extension")
    )

    const lead2 = must(
      "lead status moved with the follow-up",
      await leadActions.fetchLeads({
        page: 1,
        pageSize: 100,
        sortDir: "desc",
        status: "negotiating",
      } as never)
    )
    expect(
      "lead is now negotiating",
      lead2.rows.some((r) => r.id === lead.id)
    )

    for (const f of after) if (!bin.followup.includes(f.id)) bin.followup.push(f.id)
  })

  // -------------------------------------------------------------- bookings

  await section("bookings", async () => {
    if (!customerId) throw new Error("no customer fixture")

    mustFail(
      "end date before start date is rejected",
      await bookingActions.createBooking({
        customerId,
        title: `${TAG} Backwards Trip`,
        startDate: iso(20),
        endDate: iso(10),
        adults: 2,
        pricingMode: "fixed",
        sellSubtotal: "10000",
        taxRatePercent: 5,
      } as never)
    )

    mustFail(
      "per-pax pricing needs a per-adult price",
      await bookingActions.createBooking({
        customerId,
        title: `${TAG} Priceless Trip`,
        startDate: iso(10),
        endDate: iso(14),
        adults: 2,
        pricingMode: "per_pax",
        taxRatePercent: 5,
      } as never)
    )

    const booking = must(
      "createBooking (per-pax)",
      await bookingActions.createBooking({
        customerId,
        itineraryId: itineraryId || null,
        title: `${TAG} Munnar Family Trip`,
        destination: "Munnar",
        startDate: iso(10),
        endDate: iso(14),
        adults: 2,
        children: 1,
        infants: 0,
        pricingMode: "per_pax",
        pricePerAdult: "18500",
        pricePerChild: "9000",
        discount: "2000",
        taxRatePercent: 5,
      } as never)
    )
    bookingId = booking.id
    bin.booking.push(booking.id)

    // 2×18500 + 1×9000 = 46000; less 2000 = 44000; +5% = 46200
    expect("per-pax subtotal is expanded", booking.sellSubtotal === 4600000, String(booking.sellSubtotal))
    expect("discount is applied before tax", booking.taxAmount === 220000, String(booking.taxAmount))
    expect("grand total adds up", booking.grandTotal === 4620000, String(booking.grandTotal))

    const fetched = must("fetchBooking", await bookingActions.fetchBooking({ id: booking.id }))
    expect("fetched booking matches", fetched.id === booking.id)

    must("fetchBookingOptions", await bookingActions.fetchBookingOptions({ search: TAG }))

    const byStatus = must(
      "fetchBookings filtered by status",
      await bookingActions.fetchBookings({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        status: "confirmed",
      } as never)
    )
    expect("booking status filter holds", byStatus.rows.every((r) => r.status === "confirmed"))

    const byDate = must(
      "fetchBookings filtered by date range",
      await bookingActions.fetchBookings({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        from: iso(0),
        to: iso(30),
      } as never)
    )
    expect(
      "date range includes the new booking",
      byDate.rows.some((r) => r.id === booking.id)
    )

    const ledger0 = must(
      "fetchBookingLedger",
      await bookingActions.fetchBookingLedger({ id: booking.id })
    )
    expect("balance starts at the full total", ledger0.balance === 4620000, String(ledger0.balance))

    // ---------------------------------------------------------------- pax

    const pax = must(
      "addPax",
      await bookingActions.addPax({
        bookingId: booking.id,
        name: `${TAG} Anita Menon`,
        age: 38,
        gender: "female",
        idType: "Aadhaar",
        idNumber: "XXXX1234",
      })
    )
    bin.pax.push(pax.id)
    const paxList = must("fetchPax", await bookingActions.fetchPax({ bookingId: booking.id }))
    expect("pax is listed", paxList.some((p) => p.id === pax.id))
    must("removePax", await bookingActions.removePax({ id: pax.id }))

    // -------------------------------------------------------- trip costing

    const cost = must(
      "createTripCost",
      await bookingActions.createTripCost({
        bookingId: booking.id,
        category: "hotel",
        supplierId: supplierId || null,
        description: "Deluxe room × 4 nights",
        serviceDate: iso(10),
        quantity: 4,
        unitCost: "6400",
        sellAmount: "0",
        status: "booked",
      })
    )
    costId = cost.id
    bin.cost.push(cost.id)
    expect("cost amount is quantity × unit", cost.costAmount === 2560000, String(cost.costAmount))

    const cancelledCost = must(
      "createTripCost (cancelled line)",
      await bookingActions.createTripCost({
        bookingId: booking.id,
        category: "activity",
        description: "Cancelled boat ride",
        quantity: 1,
        unitCost: "5000",
        status: "cancelled",
      })
    )
    bin.cost.push(cancelledCost.id)

    const costs = must("fetchTripCosts", await bookingActions.fetchTripCosts({ bookingId: booking.id }))
    expect("both cost lines are listed", costs.length === 2, `${costs.length}`)

    const ledger1 = must(
      "ledger after costs",
      await bookingActions.fetchBookingLedger({ id: booking.id })
    )
    expect(
      "cancelled cost lines are excluded from P&L",
      ledger1.cost === 2560000,
      String(ledger1.cost)
    )
    expect("profit = revenue − cost", ledger1.profit === 4620000 - 2560000, String(ledger1.profit))

    must(
      "updateTripCost",
      await bookingActions.updateTripCost({
        id: cost.id,
        bookingId: booking.id,
        category: "hotel",
        supplierId: supplierId || null,
        description: "Deluxe room × 4 nights (peak)",
        quantity: 4,
        unitCost: "7200",
        status: "booked",
      })
    )

    must("deleteTripCost", await bookingActions.deleteTripCost({ id: cancelledCost.id }))

    // --------------------------------------------------------- assignments

    if (vehicleId) {
      const assignment = must(
        "assignVehicle",
        await fleetActions.assignVehicle({
          bookingId: booking.id,
          vehicleId,
          driverId: driverId || null,
          startDate: iso(10),
          endDate: iso(14),
          startOdometer: 45210,
        })
      )
      bin.assignment.push(assignment.id)

      mustFail(
        "double-booking the same vehicle is rejected",
        await fleetActions.assignVehicle({
          bookingId: booking.id,
          vehicleId,
          startDate: iso(12),
          endDate: iso(16),
        })
      )

      const assignments = must(
        "fetchAssignments",
        await fleetActions.fetchAssignments({ bookingId: booking.id })
      )
      expect("assignment is listed", assignments.some((a) => a.id === assignment.id))

      must(
        "updateAssignment",
        await fleetActions.updateAssignment({
          id: assignment.id,
          driverId: driverId || null,
          startOdometer: 45210,
          endOdometer: 46180,
        })
      )

      mustFail(
        "an assigned vehicle cannot be deleted",
        await fleetActions.deleteVehicle({ id: vehicleId })
      )
    }

    must(
      "updateBooking",
      await bookingActions.updateBooking({
        id: booking.id,
        customerId,
        title: `${TAG} Munnar Family Trip`,
        destination: "Munnar & Thekkady",
        startDate: iso(10),
        endDate: iso(14),
        adults: 2,
        children: 1,
        infants: 0,
        pricingMode: "fixed",
        sellSubtotal: "46000",
        discount: "2000",
        taxRatePercent: 5,
      } as never)
    )

    must(
      "updateBookingStatus → in_progress",
      await bookingActions.updateBookingStatus({ id: booking.id, status: "in_progress" })
    )

    mustFail(
      "cancelling through the status action is refused",
      await bookingActions.updateBookingStatus({ id: booking.id, status: "cancelled" }),
      "cancel action"
    )
  })

  // ------------------------------------------------------- invoices & money

  await section("invoices", async () => {
    if (!bookingId) throw new Error("no booking fixture")

    const invoice = must(
      "createInvoice",
      await accountActions.createInvoice({
        bookingId,
        issueDate: iso(0),
        dueDate: iso(15),
        terms: "50% advance, balance before departure.",
      })
    )

    bin.invoice.push(invoice.id)
    expect(
      "invoice total matches the booking",
      Number(invoice.total) === 4620000,
      String(invoice.total)
    )

    mustFail(
      "a second invoice for the same trip is refused",
      await accountActions.createInvoice({ bookingId, issueDate: iso(0) }),
      "already exists"
    )

    const lines = must(
      "fetchInvoiceLines",
      await accountActions.fetchInvoiceLines({ invoiceId: invoice.id })
    )
    expect("invoice has a line", lines.length === 1, `${lines.length}`)

    const list = must(
      "fetchInvoices filtered by status",
      await accountActions.fetchInvoices({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        status: "sent",
      } as never)
    )
    expect("invoice status filter holds", list.rows.every((r) => r.status === "sent"))

    // ------------------------------------------------------------ receipts

    mustFail(
      "a receipt above the balance is refused",
      await accountActions.createReceipt({
        bookingId,
        amount: "99999",
        mode: "upi",
        receivedAt: iso(0),
        isAdvance: false,
      }),
      "outstanding balance"
    )

    mustFail(
      "a zero receipt is refused",
      await accountActions.createReceipt({
        bookingId,
        amount: "0",
        mode: "cash",
        receivedAt: iso(0),
        isAdvance: false,
      })
    )

    const receipt = must(
      "createReceipt",
      await accountActions.createReceipt({
        bookingId,
        amount: "23100",
        mode: "upi",
        reference: "UPI/ZZT/0001",
        receivedAt: iso(0),
        isAdvance: true,
      })
    )
    bin.receipt.push(receipt.id)

    const half = must("invoice after part payment", await accountActions.fetchInvoices({
      page: 1,
      pageSize: 100,
      sortDir: "desc",
    } as never))
    const invRow = half.rows.find((r) => r.id === invoice.id)
    expect("part payment flips the invoice to partially_paid", invRow?.status === "partially_paid", invRow?.status)

    const ledger = must("ledger after receipt", await bookingActions.fetchBookingLedger({ id: bookingId }))
    expect("received is recorded", ledger.received === 2310000, String(ledger.received))
    expect("balance drops by the receipt", ledger.balance === 2310000, String(ledger.balance))

    mustFail(
      "an invoice with payments cannot be cancelled",
      await accountActions.cancelInvoice({ id: invoice.id, reason: "test" }),
      "void the receipts first"
    )

    mustFail(
      "a booking with money received cannot be deleted",
      await bookingActions.deleteBooking({ id: bookingId }),
      "cancel it instead"
    )

    must(
      "fetchReceipts filtered by mode",
      await accountActions.fetchReceipts({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        mode: "upi",
      } as never)
    )
    must("fetchOutstanding", await accountActions.fetchOutstanding())

    must(
      "voidReceipt",
      await accountActions.voidReceipt({ id: receipt.id, reason: "Test reversal" })
    )
    const ledger2 = must("ledger after void", await bookingActions.fetchBookingLedger({ id: bookingId }))
    expect("voiding restores the balance", ledger2.balance === 4620000, String(ledger2.balance))

    mustFail(
      "voiding twice is refused",
      await accountActions.voidReceipt({ id: receipt.id, reason: "again" }),
      "already void"
    )

    must(
      "updateInvoiceStatus",
      await accountActions.updateInvoiceStatus({ id: invoice.id, status: "sent" })
    )
    must(
      "cancelInvoice once payments are void",
      await accountActions.cancelInvoice({ id: invoice.id, reason: "Test cancellation" })
    )

    // -------------------------------------------------- supplier payments

    if (supplierId) {
      const payment = must(
        "createSupplierPayment",
        await accountActions.createSupplierPayment({
          supplierId,
          bookingId,
          tripCostItemId: costId || null,
          amount: "15000",
          mode: "bank_transfer",
          reference: "NEFT/ZZT/1",
          paidAt: iso(0),
        })
      )
      bin.supplierPayment.push(payment.id)

      must(
        "fetchSupplierPayments",
        await accountActions.fetchSupplierPayments({
          page: 1,
          pageSize: 25,
          sortDir: "desc",
        } as never)
      )

      mustFail(
        "supplier payments cannot be voided",
        await accountActions.voidSupplierPayment({ id: payment.id, reason: "test" }),
        "reversing payment"
      )

      if (costId) {
        mustFail(
          "a paid cost line cannot be deleted",
          await bookingActions.deleteTripCost({ id: costId }),
          "supplier payments"
        )
        mustFail(
          "a cost line cannot be cut below what was paid",
          await bookingActions.updateTripCost({
            id: costId,
            bookingId,
            category: "hotel",
            description: "Cut too far",
            quantity: 1,
            unitCost: "100",
            status: "booked",
          }),
          "already been paid"
        )
      }
    }
  })

  // -------------------------------------------------------------- expenses

  await section("expenses", async () => {
    const category = must(
      "createExpenseCategory",
      await accountActions.createExpenseCategory({
        name: `${TAG} Test bucket`,
        isTripRelated: true,
      })
    )
    bin.category.push(category.id)

    const categories = must("fetchExpenseCategories", await accountActions.fetchExpenseCategories())
    expect("category is listed", categories.some((c) => c.id === category.id))

    const expense = must(
      "createExpense",
      await accountActions.createExpense({
        bookingId: bookingId || null,
        vehicleId: vehicleId || null,
        categoryId: category.id,
        description: "Diesel — Kochi to Munnar",
        amount: "4200",
        spentAt: iso(0),
        mode: "cash",
      })
    )
    bin.expense.push(expense.id)
    expect("expense gets a number", Boolean(expense.number), "no number")

    mustFail(
      "a zero expense is refused",
      await accountActions.createExpense({
        description: "Nothing",
        amount: "0",
        spentAt: iso(0),
        mode: "cash",
      })
    )

    const byCategory = must(
      "fetchExpenses filtered by category",
      await accountActions.fetchExpenses({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        categoryId: category.id,
      } as never)
    )
    expect("category filter holds", byCategory.rows.every((r) => r.categoryId === category.id))

    const byRange = must(
      "fetchExpenses filtered by date range",
      await accountActions.fetchExpenses({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        from: iso(-1),
        to: iso(1),
      } as never)
    )
    expect("date range includes the expense", byRange.rows.some((r) => r.id === expense.id))

    must(
      "updateExpense",
      await accountActions.updateExpense({
        id: expense.id,
        categoryId: category.id,
        description: "Diesel — Kochi to Munnar (full tank)",
        amount: "4600",
        spentAt: iso(0),
        mode: "cash",
      })
    )

    must("approveExpense", await accountActions.approveExpense({ id: expense.id }))

    mustFail(
      "an approved expense cannot be edited",
      await accountActions.updateExpense({
        id: expense.id,
        description: "Sneaky edit",
        amount: "9999",
        spentAt: iso(0),
        mode: "cash",
      }),
      "approved expense"
    )

    mustFail(
      "an approved expense cannot be deleted",
      await accountActions.deleteExpense({ id: expense.id }),
      "approved expense"
    )

    const throwaway = must(
      "createExpense (for delete)",
      await accountActions.createExpense({
        description: "Parking",
        amount: "120",
        spentAt: iso(0),
        mode: "cash",
      })
    )
    bin.expense.push(throwaway.id)
    must("deleteExpense", await accountActions.deleteExpense({ id: throwaway.id }))
  })

  // ------------------------------------------------------- employees & hrms

  await section("employees", async () => {
    const employee = must(
      "createEmployee",
      await employeeActions.createEmployee({
        name: `${TAG} Priya Thomas`,
        phone: phone(),
        email: "priya@example.com",
        designation: "Travel consultant",
        department: "Sales",
        dateOfJoining: iso(-400),
        monthlySalary: "32000",
        status: "active",
      })
    )
    employeeId = employee.id
    bin.employee.push(employee.id)
    expect("employee gets a code", Boolean(employee.empCode), "no empCode")

    must("fetchLinkableUsers", await employeeActions.fetchLinkableUsers())
    must("fetchEmployeeOptions", await employeeActions.fetchEmployeeOptions({ search: TAG }))

    const byStatus = must(
      "fetchEmployees filtered by status",
      await employeeActions.fetchEmployees({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        status: "active",
      } as never)
    )
    expect("employee status filter holds", byStatus.rows.every((r) => r.status === "active"))

    must(
      "updateEmployee",
      await employeeActions.updateEmployee({
        id: employee.id,
        name: `${TAG} Priya Thomas`,
        phone: phone(),
        designation: "Senior travel consultant",
        department: "Sales",
        status: "active",
      })
    )

    // ---------------------------------------------------------- attendance

    must(
      "markAttendance",
      await employeeActions.markAttendance({
        employeeId: employee.id,
        date: iso(0),
        status: "present",
        checkIn: "09:30",
        checkOut: "18:15",
      })
    )

    must(
      "markAttendance again for the same day (upsert)",
      await employeeActions.markAttendance({
        employeeId: employee.id,
        date: iso(0),
        status: "half_day",
        checkIn: "09:30",
        checkOut: "13:00",
      })
    )

    const day = must(
      "fetchAttendance",
      await employeeActions.fetchAttendance({ date: iso(0) } as never)
    )
    const row = day.find((r) => r.employeeId === employee.id)
    expect(
      "re-marking updates rather than duplicating",
      row?.status === "half_day",
      String(row?.status)
    )

    must(
      "saveAttendanceDay (bulk)",
      await employeeActions.saveAttendanceDay({
        date: iso(0),
        entries: [
          {
            employeeId: employee.id,
            status: "present",
            checkIn: "09:00",
            checkOut: "18:00",
          },
        ],
      })
    )

    must(
      "fetchAttendanceSummary",
      await employeeActions.fetchAttendanceSummary({ from: iso(-7), to: iso(0) } as never)
    )

    // -------------------------------------------------------------- leave

    mustFail(
      "leave ending before it starts is rejected",
      await employeeActions.requestLeave({
        employeeId: employee.id,
        type: "casual",
        fromDate: iso(20),
        toDate: iso(10),
        reason: "Backwards",
      })
    )

    const leave = must(
      "requestLeave",
      await employeeActions.requestLeave({
        employeeId: employee.id,
        type: "casual",
        fromDate: iso(20),
        toDate: iso(22),
        reason: "Family function",
      })
    )
    bin.leave.push(leave.id)

    const pending = must(
      "fetchLeaves filtered by status",
      await employeeActions.fetchLeaves({
        page: 1,
        pageSize: 25,
        sortDir: "desc",
        status: "pending",
      } as never)
    )
    expect("leave status filter holds", pending.rows.every((r) => r.status === "pending"))

    must(
      "decideLeave → approved",
      await employeeActions.decideLeave({
        id: leave.id,
        status: "approved",
        decisionNote: "Approved",
      })
    )
  })

  // --------------------------------------------------------------- reports

  await section("reports", async () => {
    const range = { from: iso(-90), to: iso(90) }
    must("fetchProfitLoss", await reportActions.fetchProfitLoss({ ...range, groupBy: "trip" }))
    must("fetchRevenueByTrip", await reportActions.fetchRevenueByTrip({ ...range, groupBy: "trip" }))
    must(
      "fetchExpenseByCategory",
      await reportActions.fetchExpenseByCategory({ ...range, groupBy: "category" })
    )
    must(
      "fetchSupplierSpend",
      await reportActions.fetchSupplierSpend({ ...range, groupBy: "supplier" })
    )
    must(
      "fetchVehicleExpense",
      await reportActions.fetchVehicleExpense({ ...range, groupBy: "trip" })
    )
    must(
      "fetchStaffPerformance",
      await reportActions.fetchStaffPerformance({ ...range, groupBy: "staff" })
    )
    must("fetchMonthlyTrend", await reportActions.fetchMonthlyTrend({ ...range, groupBy: "month" }))
  })

  // ----------------------------------------------------------- permissions

  /**
   * Runs when the harness is called with a low-privilege cookie
   * (`?only=permissions` as a sales user), because the permission gate can only
   * be exercised by an actual session of that role.
   */
  await section("permissions", async () => {
    const session = caller
    if (session.role !== "sales") {
      pass(`skipped — needs a sales session, got ${session.role}`)
      return
    }

    must(
      "sales can read leads",
      await leadActions.fetchLeads({ page: 1, pageSize: 5, sortDir: "desc" })
    )
    must(
      "sales can read customers",
      await customerActions.fetchCustomers({ page: 1, pageSize: 5, sortDir: "desc" })
    )

    const denied = "do not have permission"
    mustFail("sales cannot list users", await userActions.fetchUsers({
      page: 1, pageSize: 5, sortDir: "desc",
    }), denied)
    mustFail(
      "sales cannot read financial reports",
      await reportActions.fetchProfitLoss({ groupBy: "trip" }),
      denied
    )
    mustFail(
      "sales cannot record payments",
      await accountActions.createReceipt({
        bookingId: "00000000-0000-0000-0000-000000000000",
        amount: "100",
        mode: "cash",
        receivedAt: iso(0),
        isAdvance: false,
      }),
      denied
    )
    mustFail(
      "sales cannot raise invoices",
      await accountActions.createInvoice({
        bookingId: "00000000-0000-0000-0000-000000000000",
        issueDate: iso(0),
      }),
      denied
    )
    mustFail(
      "sales cannot delete customers",
      await customerActions.deleteCustomer({
        id: "00000000-0000-0000-0000-000000000000",
      }),
      denied
    )
    mustFail(
      "sales cannot manage employees",
      await employeeActions.createEmployee({
        name: "Nope",
        phone: phone(),
        status: "active",
      }),
      denied
    )
    mustFail(
      "sales cannot approve expenses",
      await accountActions.approveExpense({
        id: "00000000-0000-0000-0000-000000000000",
      }),
      denied
    )

    const scoped = must(
      "sales lead list is scoped",
      await leadActions.fetchLeads({ page: 1, pageSize: 100, sortDir: "desc" })
    )
    expect(
      "a fresh sales user sees only their own leads",
      scoped.rows.every((r) => r.assignedTo === session.userId),
      `${scoped.rows.length} rows leaked`
    )
  })

  // ------------------------------------------------------- teardown & guards

  await section("teardown", async () => {
    if (bookingId) {
      must(
        "cancelBooking",
        await bookingActions.cancelBooking({
          id: bookingId,
          cancellationReason: "Harness teardown",
          cancellationCharge: "1000",
        })
      )
      mustFail(
        "a cancelled booking cannot be edited",
        await bookingActions.updateBooking({
          id: bookingId,
          customerId,
          title: "Nope",
          startDate: iso(10),
          endDate: iso(14),
          adults: 1,
          pricingMode: "fixed",
          sellSubtotal: "1000",
          taxRatePercent: 0,
        } as never),
        "cancelled booking"
      )
      mustFail(
        "cancelling twice is refused",
        await bookingActions.cancelBooking({
          id: bookingId,
          cancellationReason: "again",
        }),
        "already cancelled"
      )
    }

    if (customerId) {
      mustFail(
        "a customer with a booking cannot be deleted",
        await customerActions.deleteCustomer({ id: customerId })
      )
    }
    if (supplierId) {
      mustFail(
        "a supplier used on a cost line cannot be deleted",
        await supplierActions.deleteSupplier({ id: supplierId })
      )
    }
    if (employeeId) {
      must("deleteEmployee", await employeeActions.deleteEmployee({ id: employeeId }))
    }
    for (const id of bin.lead) {
      must("deleteLead", await leadActions.deleteLead({ id }))
    }
    if (itineraryId) {
      must("deleteItinerary", await packageActions.deleteItinerary({ id: itineraryId }))
    }
  })

  // Hard-delete everything the run created, children first.
  const purged: string[] = []
  async function purge(label: string, fn: () => Promise<unknown>) {
    try {
      await fn()
      purged.push(label)
    } catch (error) {
      fail(`cleanup ${label}`, (error as Error).message)
    }
  }

  const del = <T extends { id: unknown }>(table: T, ids: string[]) => async () => {
    if (ids.length) await db.delete(table as never).where(inArray(table.id as never, ids))
  }

  await purge("audit", async () => {
    const ids = [
      ...bin.booking, ...bin.customer, ...bin.supplier, ...bin.lead, ...bin.invoice,
      ...bin.receipt, ...bin.expense, ...bin.employee, ...bin.user, ...bin.itinerary,
      ...bin.vehicle, ...bin.driver, ...bin.cost, ...bin.supplierPayment,
    ]
    if (ids.length) await db.delete(auditLogs).where(inArray(auditLogs.entityId, ids))
  })
  await purge("invoiceLines", async () => {
    if (bin.invoice.length)
      await db.delete(invoiceLines).where(inArray(invoiceLines.invoiceId, bin.invoice))
  })
  await purge("receipts", del(receipts, bin.receipt))
  await purge("supplierPayments", del(supplierPayments, bin.supplierPayment))
  await purge("invoices", del(invoices, bin.invoice))
  await purge("expenses", del(expenses, bin.expense))
  await purge("expenseCategories", del(expenseCategories, bin.category))
  await purge("vehicleAssignments", del(vehicleAssignments, bin.assignment))
  await purge("tripCostItems", del(tripCostItems, bin.cost))
  await purge("bookingPax", del(bookingPax, bin.pax))
  await purge("bookings", del(bookings, bin.booking))
  await purge("attendance", async () => {
    if (bin.employee.length)
      await db.delete(attendance).where(inArray(attendance.employeeId, bin.employee))
  })
  await purge("leaveRequests", del(leaveRequests, bin.leave))
  await purge("employees", del(employees, bin.employee))
  await purge("leadActivities", async () => {
    if (bin.lead.length)
      await db.delete(leadActivities).where(inArray(leadActivities.leadId, bin.lead))
  })
  await purge("leadFollowups", del(leadFollowups, bin.followup))
  await purge("leads", del(leads, bin.lead))
  await purge("itineraryImages", del(itineraryImages, bin.image))
  await purge("itineraryDays", del(itineraryDays, bin.day))
  await purge("itineraries", del(itineraries, bin.itinerary))
  await purge("supplierRates", del(supplierRates, bin.rate))
  await purge("suppliers", del(suppliers, bin.supplier))
  await purge("vehicles", del(vehicles, bin.vehicle))
  await purge("drivers", del(drivers, bin.driver))
  await purge("customers", del(customers, bin.customer))
  await purge("users", del(users, bin.user))

  const failures = results.filter((r) => !r.ok)
  return NextResponse.json(
    {
      passed: results.filter((r) => r.ok && !r.name.startsWith("—")).length,
      failed: failures.length,
      failures,
      results,
    },
    { status: failures.length ? 500 : 200 }
  )
}
