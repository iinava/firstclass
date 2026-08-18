/**
 * Business-rule verification suite — `pnpm verify`.
 *
 * Runs against the real database and exercises the rules that are expensive to
 * get wrong: money arithmetic, GST, document numbering under concurrency,
 * customer dedupe, vehicle double-booking, payment allocation, delete guards
 * and per-user data scoping.
 *
 * It creates rows marked RULE/97777*, asserts, then removes them. Safe to run
 * against a development database; do not point it at production.
 */
import { eq, like } from "drizzle-orm"
import { db } from "../db/drizzle"
import { customers } from "../db/schemas/customer.schema"
import { bookings } from "../db/schemas/booking.schema"
import { receipts } from "../db/schemas/accounts.schema"
import { tripCostItems } from "../db/schemas/trip-cost.schema"
import { drivers, vehicleAssignments, vehicles } from "../db/schemas/vehicle.schema"
import { suppliers } from "../db/schemas/supplier.schema"
import { leads } from "../db/schemas/lead.schema"
import * as customerSvc from "../lib/services/customer.service"
import * as supplierSvc from "../lib/services/supplier.service"
import * as vehicleSvc from "../lib/services/vehicle.service"
import * as bookingSvc from "../lib/services/booking.service"
import { nextLeadCode, financialYear } from "../lib/codes"
import { computeTotals, toPaise, formatMoney, marginPercent } from "../lib/money"
import { hasPermission, canViewAll } from "../lib/rbac"

let pass = 0
let fail = 0
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name} ${detail}`)
  }
}

const USER = "00000000-0000-0000-0000-000000000000"

async function cleanup() {
  const bs = await db.select().from(bookings).where(like(bookings.code, "%RULE%"))
  for (const b of bs) {
    await db.delete(receipts).where(eq(receipts.bookingId, b.id))
    await db.delete(tripCostItems).where(eq(tripCostItems.bookingId, b.id))
    await db.delete(vehicleAssignments).where(eq(vehicleAssignments.bookingId, b.id))
    await db.delete(bookings).where(eq(bookings.id, b.id))
  }
  await db.delete(leads).where(like(leads.code, "%RULE%"))
  await db.delete(vehicleAssignments)
  await db.delete(vehicles).where(like(vehicles.regNumber, "RULE%"))
  await db.delete(drivers).where(like(drivers.name, "RULE%"))
  await db.delete(suppliers).where(like(suppliers.name, "RULE%"))
  await db.delete(customers).where(like(customers.phone, "97777%"))
}

async function main() {
  if (process.argv[2] === "cleanup") {
    await cleanup()
    console.log("cleaned")
    return
  }
  await cleanup()

  console.log("\n— money —")
  ok("toPaise rounds half up", toPaise("12.005") === 1201, `got ${toPaise("12.005")}`)
  ok("toPaise strips commas", toPaise("1,23,456.50") === 12345650)
  ok("empty money is zero", toPaise("") === 0)
  const t = computeTotals({ subtotal: 5400000, discount: 200000, taxRateBps: 500 })
  ok("tax is on post-discount amount", t.taxAmount === 260000, `got ${t.taxAmount}`)
  ok("grand total adds up", t.grandTotal === 5460000, `got ${t.grandTotal}`)
  ok(
    "discount cannot exceed subtotal",
    computeTotals({ subtotal: 1000, discount: 9999 }).grandTotal === 0
  )
  ok("formatMoney is INR", formatMoney(5460000).includes("54,600"))
  ok("margin percent", Math.round(marginPercent(100, 75)) === 25)

  console.log("\n— rbac —")
  ok("sales cannot see financials", !hasPermission("sales", "report:financial"))
  ok("accounts can create payments", hasPermission("accounts", "payment:create"))
  ok("admin cannot manage users", !hasPermission("admin", "user:manage"))
  ok("superadmin can manage users", hasPermission("superadmin", "user:manage"))
  ok("sales is scoped to own leads", !canViewAll("sales", "lead"))
  ok("manager sees all leads", canViewAll("manager", "lead"))
  ok("staff cannot delete customers", !hasPermission("staff", "customer:delete"))

  console.log("\n— document numbering —")
  const codes = await Promise.all([nextLeadCode(), nextLeadCode(), nextLeadCode()])
  ok("lead codes are unique under concurrency", new Set(codes).size === 3, codes.join(","))
  ok("FY for August 2026 is 26-27", financialYear(new Date("2026-08-15")) === "26-27")
  ok("FY for Feb 2026 is 25-26", financialYear(new Date("2026-02-15")) === "25-26")

  console.log("\n— customer dedupe —")
  const a = await customerSvc.upsertCustomerByPhone(
    { name: "Rules Tester", phone: "9777700001" },
    USER
  )
  const b = await customerSvc.upsertCustomerByPhone(
    { name: "Rules Tester Again", phone: "9777700001" },
    USER
  )
  ok("same phone reuses the customer", a.customer.id === b.customer.id)
  ok("first call created, second did not", a.created && !b.created)

  console.log("\n— booking ledger —")
  const start = "2026-09-01"
  const [booking] = await db
    .insert(bookings)
    .values({
      code: "FC-RULE-0001",
      customerId: a.customer.id,
      title: "Rules Test Trip",
      startDate: start,
      endDate: "2026-09-04",
      adults: 2,
      sellSubtotal: 5400000,
      discount: 200000,
      taxRateBps: 500,
      taxAmount: 260000,
      grandTotal: 5460000,
      createdBy: null,
    })
    .returning()

  const [supplier] = await db
    .insert(suppliers)
    .values({ name: "RULE Hotel", type: "hotel" })
    .returning()

  await db.insert(tripCostItems).values([
    {
      bookingId: booking.id,
      category: "hotel",
      supplierId: supplier.id,
      description: "rooms",
      quantity: 3,
      unitCost: 640000,
      costAmount: 1920000,
    },
    {
      bookingId: booking.id,
      category: "activity",
      description: "cancelled item",
      quantity: 1,
      unitCost: 999999,
      costAmount: 999999,
      status: "cancelled",
    },
  ])

  const ledger1 = await bookingSvc.getBookingLedger(booking.id)
  ok(
    "cancelled cost lines are excluded from P&L",
    ledger1.cost === 1920000,
    `got ${ledger1.cost}`
  )
  ok("profit = revenue - cost", ledger1.profit === 5460000 - 1920000)
  ok("balance equals full total before payment", ledger1.balance === 5460000)

  console.log("\n— vehicle double-booking —")
  const [driver] = await db
    .insert(drivers)
    .values({ name: "RULE Driver", phone: "9777700002" })
    .returning()
  const [vehicle] = await db
    .insert(vehicles)
    .values({ regNumber: "RULE0001", type: "suv", seatingCapacity: 7 })
    .returning()

  await db.insert(vehicleAssignments).values({
    bookingId: booking.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    startDate: "2026-09-01",
    endDate: "2026-09-04",
  })

  ok(
    "exact overlap is rejected",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-09-01", "2026-09-04")) !== null
  )
  ok(
    "partial overlap at the start is rejected",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-08-30", "2026-09-02")) !== null
  )
  ok(
    "partial overlap at the end is rejected",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-09-03", "2026-09-08")) !== null
  )
  ok(
    "enclosing range is rejected",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-08-01", "2026-10-01")) !== null
  )
  ok(
    "adjacent range before is allowed",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-08-25", "2026-08-31")) === null
  )
  ok(
    "adjacent range after is allowed",
    (await vehicleSvc.findAssignmentConflict(vehicle.id, "2026-09-05", "2026-09-09")) === null
  )

  console.log("\n— delete guards —")
  const custDel = await customerSvc.softDeleteCustomer(a.customer.id)
  ok("customer with a booking cannot be deleted", custDel.ok === false)
  const supDel = await supplierSvc.softDeleteSupplier(supplier.id)
  ok("supplier used on a cost line cannot be deleted", supDel.ok === false)
  const vehDel = await vehicleSvc.softDeleteVehicle(vehicle.id)
  ok("assigned vehicle cannot be deleted", vehDel.ok === false)

  console.log("\n— scoping —")
  const all = await bookingSvc.listBookings({
    page: 1,
    pageSize: 50,
    sortDir: "desc",
  } as never)
  const scoped = await bookingSvc.listBookings(
    { page: 1, pageSize: 50, sortDir: "desc" } as never,
    "11111111-1111-1111-1111-111111111111"
  )
  ok("unscoped list sees the booking", all.rows.some((r) => r.code === "FC-RULE-0001"))
  ok("scoped list excludes other users' bookings", scoped.rows.length === 0)

  await cleanup()

  console.log(`\n${pass} passed, ${fail} failed\n`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
