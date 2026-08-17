/**
 * Demo dataset — `pnpm db:seed:demo`.
 *
 * Fills every module with a coherent Kerala travel-agency business so the app
 * demos well: enquiries at each pipeline stage, packages and quotes, trips that
 * have already run and trips still to come, with the invoices, receipts,
 * supplier payments and expenses that go with them.
 *
 * Coherent is the point. A booking's stored totals, its invoice, the receipts
 * against it and the ledger all agree, because the money is computed with the
 * same `computeTotals` the app uses rather than typed in twice.
 *
 * Re-runnable: every id it writes is recorded in `app_settings` under
 * `demo:seed`, and a re-run removes the previous demo set first. Rows you
 * created by hand are never touched.
 *
 *   pnpm db:seed:demo          # replace the demo dataset
 *   pnpm db:seed:demo clean    # remove it and stop
 *
 * Dates are relative to the day it is run, so the follow-up queue and the
 * "upcoming trips" panel always look alive.
 */
import { eq, inArray } from "drizzle-orm"
import { db } from "../db/drizzle"
import {
  expenseCategories,
  expenses,
  invoiceLines,
  invoices,
  receipts,
  supplierPayments,
} from "../db/schemas/accounts.schema"
import { bookingPax, bookings } from "../db/schemas/booking.schema"
import { customers } from "../db/schemas/customer.schema"
import { attendance, employees, leaveRequests } from "../db/schemas/hrms.schema"
import {
  itineraries,
  itineraryDays,
  itineraryImages,
} from "../db/schemas/itinerary.schema"
import { leadActivities, leadFollowups, leads } from "../db/schemas/lead.schema"
import { supplierRates, suppliers } from "../db/schemas/supplier.schema"
import { appSettings } from "../db/schemas/system.schema"
import { costCategoryEnum, tripCostItems } from "../db/schemas/trip-cost.schema"
import { users } from "../db/schemas/user.schema"
import { drivers, vehicleAssignments, vehicles } from "../db/schemas/vehicle.schema"
import {
  generateShareToken,
  nextBookingCode,
  nextEmployeeCode,
  nextExpenseNumber,
  nextInvoiceNumber,
  nextLeadCode,
  nextPackageCode,
  nextQuoteCode,
  nextReceiptNumber,
  nextSupplierPaymentNumber,
} from "../lib/codes"
import { computeTotals, toPaise } from "../lib/money"
import { hashPassword } from "../lib/password"

const MANIFEST_KEY = "demo:seed"

/** Ids written by this run, so the next run can undo exactly this much. */
type Manifest = Record<string, string[]>
const made: Manifest = {}
const track = (table: string, ids: string[]) => {
  made[table] = [...(made[table] ?? []), ...ids]
  return ids
}

// ------------------------------------------------------------------- dates

const TODAY = new Date()
/** Offset in days from today, as a Postgres `date` string. */
function day(offset: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
/** Offset in days plus a wall-clock time, as a timestamp. */
function at(offset: number, time = "10:00"): Date {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d
}
const rupees = (v: number | string) => toPaise(v)

// ------------------------------------------------------------------ cleanup

/**
 * Deletes a previous demo set, children before parents.
 *
 * Reads the manifest rather than guessing from name patterns, so hand-entered
 * records that happen to look similar survive.
 */
async function clean(): Promise<number> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, MANIFEST_KEY))
    .limit(1)

  if (!row?.value) return 0
  const previous = row.value as Manifest

  // Child-to-parent. Anything with ON DELETE CASCADE still listed explicitly,
  // so the count reported back is honest.
  const order: [string, { id: unknown }][] = [
    ["invoiceLines", invoiceLines],
    ["receipts", receipts],
    ["supplierPayments", supplierPayments],
    ["invoices", invoices],
    ["expenses", expenses],
    ["expenseCategories", expenseCategories],
    ["vehicleAssignments", vehicleAssignments],
    ["tripCostItems", tripCostItems],
    ["bookingPax", bookingPax],
    ["bookings", bookings],
    ["attendance", attendance],
    ["leaveRequests", leaveRequests],
    ["employees", employees],
    ["leadActivities", leadActivities],
    ["leadFollowups", leadFollowups],
    ["itineraryImages", itineraryImages],
    ["itineraryDays", itineraryDays],
    ["itineraries", itineraries],
    ["leads", leads],
    // Vehicles before suppliers: a hired vehicle points at the supplier it came
    // from, and drivers before neither — vehicles point at a default driver.
    ["vehicles", vehicles],
    ["drivers", drivers],
    ["supplierRates", supplierRates],
    ["suppliers", suppliers],
    ["customers", customers],
    ["users", users],
  ]

  let removed = 0
  for (const [name, table] of order) {
    const ids = previous[name]
    if (!ids?.length) continue
    // Neon caps statement size; chunk so a big demo set still deletes.
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      await db.delete(table as never).where(inArray(table.id as never, chunk))
    }
    removed += ids.length
  }

  await db.delete(appSettings).where(eq(appSettings.key, MANIFEST_KEY))
  return removed
}

// --------------------------------------------------------------------- data

const CUSTOMERS = [
  { name: "Anitha Menon", phone: "9847012001", city: "Kochi", source: "referral", email: "anitha.menon@example.com" },
  { name: "Rajesh Pillai", phone: "9847012002", city: "Thiruvananthapuram", source: "instagram", email: "rajesh.pillai@example.com" },
  { name: "Fathima Beevi", phone: "9847012003", city: "Kozhikode", source: "whatsapp", email: null },
  { name: "George Mathew", phone: "9847012004", city: "Kottayam", source: "repeat", email: "george.mathew@example.com" },
  { name: "Sneha Krishnan", phone: "9847012005", city: "Thrissur", source: "website", email: "sneha.k@example.com" },
  { name: "Arun Varghese", phone: "9847012006", city: "Alappuzha", source: "walk_in", email: null },
  { name: "Deepa Nair", phone: "9847012007", city: "Kochi", source: "referral", email: "deepa.nair@example.com" },
  { name: "Mohammed Ashraf", phone: "9847012008", city: "Malappuram", source: "phone", email: null },
  { name: "Lakshmi Iyer", phone: "9847012009", city: "Palakkad", source: "facebook", email: "lakshmi.iyer@example.com" },
  { name: "Vinod Chandran", phone: "9847012010", city: "Kannur", source: "instagram", email: null },
  { name: "Priya Suresh", phone: "9847012011", city: "Bengaluru", source: "website", email: "priya.suresh@example.com" },
  { name: "Thomas Kurien", phone: "9847012012", city: "Idukki", source: "repeat", email: "t.kurien@example.com" },
] as const

const SUPPLIERS = [
  { name: "Tea Valley Resort", type: "resort", city: "Munnar", contact: "Rajan Nair", phone: "9847020001", rating: 5, terms: "50% advance, balance on checkout" },
  { name: "Backwater Palace Houseboat", type: "transport", city: "Alappuzha", contact: "Shibu Thomas", phone: "9847020002", rating: 4, terms: "Full advance" },
  { name: "Spice Garden Homestay", type: "homestay", city: "Thekkady", contact: "Mary Joseph", phone: "9847020003", rating: 4, terms: "Pay on departure" },
  { name: "Marari Beach Hotel", type: "hotel", city: "Mararikulam", contact: "Anil Kumar", phone: "9847020004", rating: 4, terms: "30% advance" },
  { name: "Western Ghats Travels", type: "transport", city: "Kochi", contact: "Sunil Menon", phone: "9847020005", rating: 5, terms: "Monthly settlement" },
  { name: "Periyar Nature Guides", type: "guide", city: "Thekkady", contact: "Biju P", phone: "9847020006", rating: 5, terms: "Cash on the day" },
  { name: "Athirappilly Adventures", type: "activity", city: "Athirappilly", contact: "Rahul Das", phone: "9847020007", rating: 3, terms: "Pay on the day" },
  { name: "Kumarakom Lake Resort", type: "resort", city: "Kumarakom", contact: "Jose Varkey", phone: "9847020008", rating: 5, terms: "50% advance" },
  { name: "Malabar Kitchen", type: "restaurant", city: "Kozhikode", contact: "Ummer Farooq", phone: "9847020009", rating: 4, terms: "Weekly settlement" },
  { name: "Coastal Air Tickets", type: "airline", city: "Kochi", contact: "Nisha R", phone: "9847020010", rating: 4, terms: "Immediate" },
] as const

const RATES: Record<string, { title: string; unit: string; rate: string }[]> = {
  "Tea Valley Resort": [
    { title: "Deluxe room", unit: "per night", rate: "6400" },
    { title: "Premium cottage", unit: "per night", rate: "9200" },
  ],
  "Backwater Palace Houseboat": [
    { title: "1BHK houseboat", unit: "per night", rate: "12000" },
    { title: "2BHK houseboat", unit: "per night", rate: "18500" },
  ],
  "Spice Garden Homestay": [{ title: "Double room", unit: "per night", rate: "2800" }],
  "Marari Beach Hotel": [{ title: "Sea-facing room", unit: "per night", rate: "7500" }],
  "Western Ghats Travels": [
    { title: "Tempo Traveller", unit: "per day", rate: "4800" },
    { title: "Innova Crysta", unit: "per day", rate: "3600" },
  ],
  "Periyar Nature Guides": [{ title: "Nature walk", unit: "per person", rate: "850" }],
  "Kumarakom Lake Resort": [{ title: "Lake-view villa", unit: "per night", rate: "11500" }],
}

const DRIVERS = [
  { name: "Suresh Kumar", phone: "9847030001", licence: "KL0720180001", allowance: "800" },
  { name: "Biju Varghese", phone: "9847030002", licence: "KL0720190142", allowance: "800" },
  { name: "Ajay Mohan", phone: "9847030003", licence: "KL1120200087", allowance: "900" },
  { name: "Shaji Thomas", phone: "9847030004", licence: "KL0520170455", allowance: "750" },
  { name: "Ramesh Babu", phone: "9847030005", licence: "KL0820210311", allowance: "850" },
] as const

const VEHICLES = [
  { reg: "KL07AB1234", type: "tempo_traveller", make: "Force", model: "Traveller 3350", seats: 14, ownership: "owned", perKm: "24", perDay: "4800" },
  { reg: "KL07CD5678", type: "suv", make: "Toyota", model: "Innova Crysta", seats: 7, ownership: "owned", perKm: "18", perDay: "3600" },
  { reg: "KL11EF9012", type: "sedan", make: "Maruti", model: "Dzire", seats: 4, ownership: "owned", perKm: "14", perDay: "2600" },
  { reg: "KL05GH3456", type: "mini_bus", make: "Eicher", model: "Skyline 21", seats: 21, ownership: "hired", perKm: "34", perDay: "7200" },
  { reg: "KL08IJ7890", type: "suv", make: "Mahindra", model: "Scorpio N", seats: 7, ownership: "owned", perKm: "17", perDay: "3400" },
  { reg: "KL01KL2345", type: "hatchback", make: "Hyundai", model: "i20", seats: 4, ownership: "hired", perKm: "12", perDay: "2200" },
] as const

const STAFF = [
  { username: "meera.manager", name: "Meera Raghavan", role: "manager", designation: "Operations Manager", department: "Management", salary: "68000" },
  { username: "arjun.sales", name: "Arjun Das", role: "sales", designation: "Senior Travel Consultant", department: "Sales", salary: "38000" },
  { username: "nithya.sales", name: "Nithya Pillai", role: "sales", designation: "Travel Consultant", department: "Sales", salary: "32000" },
  { username: "faisal.ops", name: "Faisal Rahman", role: "ops", designation: "Trip Coordinator", department: "Operations", salary: "35000" },
  { username: "reena.accounts", name: "Reena Jacob", role: "accounts", designation: "Accounts Executive", department: "Accounts", salary: "40000" },
] as const

/** Non-login staff, so the employee list is not a mirror of the user list. */
const EXTRA_EMPLOYEES = [
  { name: "Sajeev Menon", phone: "9847040006", designation: "Driver Supervisor", department: "Operations", salary: "26000", status: "active" },
  { name: "Anju Thomas", phone: "9847040007", designation: "Front Desk", department: "Admin", salary: "22000", status: "active" },
  { name: "Hari Kumar", phone: "9847040008", designation: "Trip Coordinator", department: "Operations", salary: "30000", status: "on_leave" },
  { name: "Divya Ramesh", phone: "9847040009", designation: "Marketing Associate", department: "Sales", salary: "28000", status: "resigned" },
] as const

// ------------------------------------------------------------------ seeding

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data into a production environment.")
    process.exit(1)
  }

  const removed = await clean()
  if (removed) console.log(`Removed ${removed} rows from the previous demo set.`)

  if (process.argv[2] === "clean") {
    console.log("Demo data cleared.")
    return
  }

  // ---------------------------------------------------------------- staff

  const password = await hashPassword("Demo@1234")
  const staffRows = await db
    .insert(users)
    .values(
      STAFF.map((s) => ({
        username: s.username,
        passwordHash: password,
        name: s.name,
        email: `${s.username}@firstclasstravels.example`,
        role: s.role,
        isActive: true,
      }))
    )
    .returning()
  track("users", staffRows.map((r) => r.id))

  const byRole = (role: string) => staffRows.find((r) => r.role === role)!
  const manager = byRole("manager")
  const salesA = staffRows.find((r) => r.username === "arjun.sales")!
  const salesB = staffRows.find((r) => r.username === "nithya.sales")!
  const ops = byRole("ops")
  const accountant = byRole("accounts")

  // Employees: the five with logins, plus four without.
  const employeeRows = []
  for (const [index, s] of STAFF.entries()) {
    const [row] = await db
      .insert(employees)
      .values({
        userId: staffRows[index].id,
        empCode: await nextEmployeeCode(),
        name: s.name,
        phone: `98470400${String(index + 1).padStart(2, "0")}`,
        email: `${s.username}@firstclasstravels.example`,
        designation: s.designation,
        department: s.department,
        dateOfJoining: day(-420 - index * 90),
        monthlySalary: rupees(s.salary),
        status: "active",
      })
      .returning()
    employeeRows.push(row)
  }
  for (const e of EXTRA_EMPLOYEES) {
    const [row] = await db
      .insert(employees)
      .values({
        empCode: await nextEmployeeCode(),
        name: e.name,
        phone: e.phone,
        designation: e.designation,
        department: e.department,
        dateOfJoining: day(-300),
        monthlySalary: rupees(e.salary),
        status: e.status,
      })
      .returning()
    employeeRows.push(row)
  }
  track("employees", employeeRows.map((r) => r.id))

  // Attendance for the last three weeks, weekends off, a couple of absences.
  const attendanceValues = []
  for (let back = 21; back >= 0; back--) {
    const date = day(-back)
    const weekday = new Date(date).getDay()
    for (const [index, employee] of employeeRows.entries()) {
      if (employee.status === "resigned") continue
      let status: "present" | "week_off" | "leave" | "half_day" | "absent" = "present"
      if (weekday === 0) status = "week_off"
      else if (employee.status === "on_leave" && back < 5) status = "leave"
      else if ((back + index) % 17 === 0) status = "half_day"
      else if ((back + index) % 23 === 0) status = "absent"

      const worked = status === "present" ? 510 : status === "half_day" ? 240 : null
      attendanceValues.push({
        employeeId: employee.id,
        date,
        status,
        checkIn: status === "present" || status === "half_day" ? "09:30:00" : null,
        checkOut: status === "present" ? "18:00:00" : status === "half_day" ? "13:30:00" : null,
        workedMinutes: worked,
        markedBy: manager.id,
      })
    }
  }
  const attendanceRows = []
  for (let i = 0; i < attendanceValues.length; i += 200) {
    attendanceRows.push(
      ...(await db
        .insert(attendance)
        .values(attendanceValues.slice(i, i + 200))
        .returning({ id: attendance.id }))
    )
  }
  track("attendance", attendanceRows.map((r) => r.id))

  const leaveRows = await db
    .insert(leaveRequests)
    .values([
      { employeeId: employeeRows[7].id, type: "casual", fromDate: day(4), toDate: day(6), days: 3, reason: "Family function", status: "pending" },
      { employeeId: employeeRows[2].id, type: "sick", fromDate: day(-9), toDate: day(-8), days: 2, reason: "Viral fever", status: "approved", decidedBy: manager.id, decidedAt: at(-10), decisionNote: "Get well soon" },
      { employeeId: employeeRows[5].id, type: "paid", fromDate: day(12), toDate: day(16), days: 5, reason: "Annual leave", status: "pending" },
      { employeeId: employeeRows[3].id, type: "comp_off", fromDate: day(-2), toDate: day(-2), days: 1, reason: "Worked the Onam weekend", status: "approved", decidedBy: manager.id, decidedAt: at(-4) },
      { employeeId: employeeRows[6].id, type: "unpaid", fromDate: day(-20), toDate: day(-19), days: 2, reason: "Personal", status: "rejected", decidedBy: manager.id, decidedAt: at(-22), decisionNote: "Peak season — please reschedule" },
    ])
    .returning({ id: leaveRequests.id })
  track("leaveRequests", leaveRows.map((r) => r.id))

  // ------------------------------------------------------------ customers

  const customerRows = await db
    .insert(customers)
    .values(
      CUSTOMERS.map((c, i) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city,
        state: c.city === "Bengaluru" ? "Karnataka" : "Kerala",
        source: c.source,
        createdBy: i % 2 ? salesA.id : salesB.id,
      }))
    )
    .returning()
  track("customers", customerRows.map((r) => r.id))
  const customer = (name: string) => customerRows.find((c) => c.name === name)!

  // ------------------------------------------------------------ suppliers

  const supplierRows = await db
    .insert(suppliers)
    .values(
      SUPPLIERS.map((s) => ({
        name: s.name,
        type: s.type,
        contactPerson: s.contact,
        phone: s.phone,
        city: s.city,
        state: "Kerala",
        paymentTerms: s.terms,
        rating: s.rating,
        isActive: true,
        createdBy: ops.id,
      }))
    )
    .returning()
  track("suppliers", supplierRows.map((r) => r.id))
  const supplier = (name: string) => supplierRows.find((s) => s.name === name)!

  const rateValues = Object.entries(RATES).flatMap(([name, list]) =>
    list.map((r) => ({
      supplierId: supplier(name).id,
      title: r.title,
      unit: r.unit,
      rate: rupees(r.rate),
      validFrom: day(-120),
      validTo: day(240),
    }))
  )
  const rateRows = await db.insert(supplierRates).values(rateValues).returning({ id: supplierRates.id })
  track("supplierRates", rateRows.map((r) => r.id))

  // ---------------------------------------------------------------- fleet

  const driverRows = await db
    .insert(drivers)
    .values(
      DRIVERS.map((d) => ({
        name: d.name,
        phone: d.phone,
        licenseNumber: d.licence,
        licenseExpiry: day(500),
        dailyAllowance: rupees(d.allowance),
        isActive: true,
      }))
    )
    .returning()
  track("drivers", driverRows.map((r) => r.id))

  const vehicleRows = await db
    .insert(vehicles)
    .values(
      VEHICLES.map((v, i) => ({
        regNumber: v.reg,
        type: v.type,
        make: v.make,
        model: v.model,
        seatingCapacity: v.seats,
        ownership: v.ownership,
        supplierId: v.ownership === "hired" ? supplier("Western Ghats Travels").id : null,
        defaultDriverId: driverRows[i % driverRows.length].id,
        ratePerKm: rupees(v.perKm),
        ratePerDay: rupees(v.perDay),
        insuranceExpiry: day(120 + i * 30),
        fitnessExpiry: day(200 + i * 20),
        pucExpiry: day(60 + i * 15),
        isActive: true,
        createdBy: ops.id,
      }))
    )
    .returning()
  track("vehicles", vehicleRows.map((r) => r.id))

  // ------------------------------------------------------------- packages

  interface DaySpec {
    title: string
    description: string
    stay?: string
    meals?: ("b" | "l" | "d")[]
  }

  /**
   * Shared photo pool. Every URL here was checked to resolve — a 404 cover
   * leaves a placeholder card on the public catalogue, which is the first thing
   * a customer sees.
   */
  const PHOTO = {
    forest: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200",
    houseboat: "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=1200",
    canoe: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=1200",
    hills: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200",
    lakeside: "https://images.unsplash.com/photo-1587922546307-776227941871?w=1200",
    beach: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200",
  }

  const PACKAGES: {
    title: string
    destination: string
    nights: number
    summary: string
    perAdult: string
    perChild: string
    inclusions: string[]
    exclusions: string[]
    cover: string
    /** Extra shots for the catalogue photo strip and the share-page gallery. */
    gallery: string[]
    days: DaySpec[]
  }[] = [
    {
      title: "Munnar & Thekkady 3N/4D",
      destination: "Munnar, Thekkady",
      nights: 3,
      summary: "Tea gardens, a spice plantation walk and the Periyar reserve at dawn.",
      perAdult: "16500",
      perChild: "8500",
      inclusions: ["Accommodation on twin sharing", "Daily breakfast and dinner", "Private cab with driver", "Toll, parking and driver bata"],
      exclusions: ["Airfare and train fare", "Entry tickets and safari charges", "Anything not mentioned in inclusions"],
      cover: PHOTO.forest,
      gallery: [PHOTO.hills, PHOTO.canoe, PHOTO.lakeside],
      days: [
        { title: "Kochi → Munnar", description: "Drive up through Cheeyappara and Valara waterfalls, stopping at the spice stalls on the ghat road. Evening free at the resort.", stay: "Tea Valley Resort, Munnar", meals: ["l", "d"] },
        { title: "Munnar sightseeing", description: "Mattupetty dam, Echo Point, the tea museum and Top Station in the afternoon.", stay: "Tea Valley Resort, Munnar", meals: ["b", "d"] },
        { title: "Munnar → Thekkady", description: "Transfer to Thekkady, afternoon spice plantation walk and an evening Kalaripayattu show.", stay: "Spice Garden Homestay, Thekkady", meals: ["b", "d"] },
        { title: "Thekkady → Kochi", description: "Early Periyar lake boat ride, then drive back to Kochi for the onward journey.", meals: ["b"] },
      ],
    },
    {
      title: "Alleppey Houseboat 1N/2D",
      destination: "Alappuzha",
      nights: 1,
      summary: "A night on the backwaters with a cook on board and paddy fields either side.",
      perAdult: "9500",
      perChild: "5000",
      inclusions: ["Air-conditioned houseboat", "Lunch, evening tea, dinner and breakfast", "Boarding at Punnamada jetty"],
      exclusions: ["Transport to and from the jetty", "Alcoholic beverages"],
      cover: PHOTO.houseboat,
      gallery: [PHOTO.canoe, PHOTO.lakeside, PHOTO.beach],
      days: [
        { title: "Board at Punnamada", description: "Check in at noon, cruise past the Kuttanad paddy fields, moor for the night near a village jetty.", stay: "Backwater Palace Houseboat", meals: ["l", "d"] },
        { title: "Morning cruise and disembark", description: "Sunrise over the backwaters, breakfast on deck, disembark by 9am.", meals: ["b"] },
      ],
    },
    {
      title: "Kerala Grand Tour 6N/7D",
      destination: "Kochi, Munnar, Thekkady, Alleppey, Kovalam",
      nights: 6,
      summary: "The full circuit — hill station, wildlife, backwaters and a beach finish.",
      perAdult: "34500",
      perChild: "18000",
      inclusions: ["6 nights accommodation", "Daily breakfast", "Houseboat with all meals", "Private vehicle throughout"],
      exclusions: ["Airfare", "Lunch and dinner except on the houseboat", "Monument entry fees"],
      cover: PHOTO.canoe,
      gallery: [PHOTO.forest, PHOTO.hills, PHOTO.houseboat, PHOTO.beach],
      days: [
        { title: "Arrive Kochi", description: "Airport pickup, Fort Kochi walk, Chinese fishing nets and a Kathakali performance in the evening.", stay: "Hotel in Fort Kochi", meals: ["d"] },
        { title: "Kochi → Munnar", description: "Scenic drive to the hills with waterfall stops.", stay: "Tea Valley Resort, Munnar", meals: ["b"] },
        { title: "Munnar full day", description: "Eravikulam National Park, tea museum and Mattupetty dam.", stay: "Tea Valley Resort, Munnar", meals: ["b"] },
        { title: "Munnar → Thekkady", description: "Spice plantation tour and the Periyar reserve.", stay: "Spice Garden Homestay, Thekkady", meals: ["b"] },
        { title: "Thekkady → Alleppey", description: "Board the houseboat at noon for an overnight backwater cruise.", stay: "Backwater Palace Houseboat", meals: ["b", "l", "d"] },
        { title: "Alleppey → Kovalam", description: "Disembark and drive south to the coast. Evening on Lighthouse beach.", stay: "Beach resort, Kovalam", meals: ["b"] },
        { title: "Depart Thiruvananthapuram", description: "Morning at leisure, transfer to the airport.", meals: ["b"] },
      ],
    },
    {
      title: "Wayanad Weekend 2N/3D",
      destination: "Wayanad",
      nights: 2,
      summary: "Edakkal caves, a bamboo raft on Pookode lake and coffee estates all the way.",
      perAdult: "11500",
      perChild: "6000",
      inclusions: ["Resort stay on twin sharing", "Breakfast and dinner", "Sightseeing by private cab"],
      exclusions: ["Entry tickets", "Jeep safari to Chembra peak"],
      cover: PHOTO.hills,
      gallery: [PHOTO.forest, PHOTO.canoe, PHOTO.lakeside],
      days: [
        { title: "Kozhikode → Wayanad", description: "Climb the Thamarassery ghat, check in and spend the evening at the coffee estate.", stay: "Estate resort, Vythiri", meals: ["d"] },
        { title: "Wayanad sightseeing", description: "Edakkal caves, Pookode lake and the Soochipara falls.", stay: "Estate resort, Vythiri", meals: ["b", "d"] },
        { title: "Return", description: "Banasura Sagar dam on the way down, drop at Kozhikode.", meals: ["b"] },
      ],
    },
    {
      title: "Kumarakom Lakeside 2N/3D",
      destination: "Kumarakom",
      nights: 2,
      summary: "A slow, quiet stay on Vembanad lake — bird sanctuary, sunset cruise, nothing rushed.",
      perAdult: "18500",
      perChild: "9500",
      inclusions: ["Lake-view villa", "All meals", "Sunset cruise", "Airport transfers"],
      exclusions: ["Ayurvedic treatments", "Bird sanctuary entry"],
      cover: PHOTO.lakeside,
      gallery: [PHOTO.houseboat, PHOTO.canoe, PHOTO.beach],
      days: [
        { title: "Arrive Kumarakom", description: "Check in at the lake resort, evening sunset cruise on Vembanad.", stay: "Kumarakom Lake Resort", meals: ["l", "d"] },
        { title: "Bird sanctuary and village walk", description: "Early morning at the bird sanctuary, afternoon at leisure, village walk before dinner.", stay: "Kumarakom Lake Resort", meals: ["b", "l", "d"] },
        { title: "Depart", description: "Breakfast and transfer to Kochi airport.", meals: ["b"] },
      ],
    },
  ]

  const packageRows: (typeof itineraries.$inferSelect)[] = []
  for (const p of PACKAGES) {
    const [row] = await db
      .insert(itineraries)
      .values({
        code: await nextPackageCode(),
        kind: "package",
        title: p.title,
        shareToken: generateShareToken(),
        isShareEnabled: true,
        destination: p.destination,
        durationDays: p.nights + 1,
        durationNights: p.nights,
        summary: p.summary,
        coverImageUrl: p.cover,
        pricingMode: "per_pax",
        pricePerAdult: rupees(p.perAdult),
        pricePerChild: rupees(p.perChild),
        inclusions: p.inclusions,
        exclusions: p.exclusions,
        termsAndConditions:
          "Rates are per person on twin sharing and valid for the season shown. Confirmation is subject to availability at the time of booking. Cancellation within 7 days of travel attracts a 50% charge.",
        status: "published",
        validUntil: day(180),
        viewCount: 20 + p.nights * 13,
        lastViewedAt: at(-2, "19:20"),
        createdBy: salesA.id,
      })
      .returning()
    packageRows.push(row)

    const dayRows = await db
      .insert(itineraryDays)
      .values(
        p.days.map((d, i) => ({
          itineraryId: row.id,
          dayNumber: i + 1,
          title: d.title,
          description: d.description,
          stayNote: d.stay ?? null,
          breakfast: Boolean(d.meals?.includes("b")),
          lunch: Boolean(d.meals?.includes("l")),
          dinner: Boolean(d.meals?.includes("d")),
        }))
      )
      .returning({ id: itineraryDays.id })
    track("itineraryDays", dayRows.map((r) => r.id))

    // Cover first, then the gallery. The catalogue strip and the share page
    // both read these, so a package with one photo looks thin in two places.
    const imageRows = await db
      .insert(itineraryImages)
      .values([
        {
          itineraryId: row.id,
          url: p.cover,
          caption: p.destination.split(",")[0],
          sortOrder: 0,
        },
        ...p.gallery.map((url, index) => ({
          itineraryId: row.id,
          // Pin the first few to a day so the day-by-day plan has pictures too.
          dayId: dayRows[index]?.id ?? null,
          url,
          caption: p.days[index]?.title ?? p.destination,
          sortOrder: index + 1,
        })),
      ])
      .returning({ id: itineraryImages.id })
    track("itineraryImages", imageRows.map((r) => r.id))
  }
  track("itineraries", packageRows.map((r) => r.id))
  const pkg = (titleStartsWith: string) =>
    packageRows.find((p) => p.title.startsWith(titleStartsWith))!

  // ----------------------------------------------------------------- leads

  const LEADS = [
    { customer: "Anitha Menon", destination: "Munnar & Thekkady", status: "won", priority: "high", source: "referral", adults: 2, children: 1, budget: "55000", days: 4, travel: 10, owner: "a", requirements: "Prefers a resort with a play area for the child." },
    { customer: "Rajesh Pillai", destination: "Alleppey houseboat", status: "won", priority: "medium", source: "instagram", adults: 2, children: 0, budget: "22000", days: 2, travel: -25, owner: "b", requirements: "Anniversary trip — asked for a decorated room." },
    { customer: "Fathima Beevi", destination: "Wayanad", status: "negotiating", priority: "high", source: "whatsapp", adults: 6, children: 2, budget: "95000", days: 3, travel: 24, owner: "a", requirements: "Two families travelling together, need a 14-seater." },
    { customer: "George Mathew", destination: "Kerala grand tour", status: "won", priority: "high", source: "repeat", adults: 4, children: 0, budget: "150000", days: 7, travel: -60, owner: "b", requirements: "Repeat customer. Wants the same driver as last time." },
    { customer: "Sneha Krishnan", destination: "Kumarakom", status: "quoted", priority: "medium", source: "website", adults: 2, children: 0, budget: "45000", days: 3, travel: 38, owner: "a", requirements: "Honeymoon. Lake-view villa is a must." },
    { customer: "Arun Varghese", destination: "Munnar", status: "contacted", priority: "low", source: "walk_in", adults: 3, children: 1, budget: "35000", days: 3, travel: 55, owner: "b", requirements: "Flexible on dates, looking for the best price." },
    { customer: "Deepa Nair", destination: "Athirappilly day trip", status: "new", priority: "medium", source: "referral", adults: 8, children: 4, budget: "28000", days: 1, travel: 14, owner: "a", requirements: "Office outing, needs a mini bus." },
    { customer: "Mohammed Ashraf", destination: "Kovalam & Poovar", status: "new", priority: "high", source: "phone", adults: 2, children: 2, budget: "60000", days: 4, travel: 30, owner: "b", requirements: "Asked for beachfront only." },
    { customer: "Lakshmi Iyer", destination: "Thekkady", status: "lost", priority: "low", source: "facebook", adults: 2, children: 0, budget: "18000", days: 2, travel: 8, owner: "a", requirements: "", lost: "Booked directly with a resort" },
    { customer: "Vinod Chandran", destination: "Wayanad & Coorg", status: "negotiating", priority: "medium", source: "instagram", adults: 4, children: 0, budget: "72000", days: 5, travel: 42, owner: "b", requirements: "Wants the Coorg extension priced separately." },
    { customer: "Priya Suresh", destination: "Kerala grand tour", status: "quoted", priority: "high", source: "website", adults: 2, children: 1, budget: "110000", days: 7, travel: 65, owner: "a", requirements: "Flying in from Bengaluru, needs airport pickup." },
    { customer: "Thomas Kurien", destination: "Munnar", status: "won", priority: "medium", source: "repeat", adults: 2, children: 0, budget: "30000", days: 3, travel: 5, owner: "b", requirements: "Third trip with us." },
    { customer: "Deepa Nair", destination: "Alleppey houseboat", status: "contacted", priority: "medium", source: "referral", adults: 2, children: 0, budget: "20000", days: 2, travel: 70, owner: "a", requirements: "Asked about the 2BHK boat." },
    { customer: "Sneha Krishnan", destination: "Marari beach", status: "lost", priority: "low", source: "website", adults: 2, children: 0, budget: "25000", days: 2, travel: -15, owner: "b", requirements: "", lost: "Postponed the trip" },
  ] as const

  const leadRows: (typeof leads.$inferSelect)[] = []
  for (const l of LEADS) {
    const owner = l.owner === "a" ? salesA : salesB
    const [row] = await db
      .insert(leads)
      .values({
        code: await nextLeadCode(),
        customerId: customer(l.customer).id,
        destination: l.destination,
        travelDate: day(l.travel),
        durationDays: l.days,
        adults: l.adults,
        children: l.children,
        budget: rupees(l.budget),
        status: l.status,
        priority: l.priority,
        source: l.source,
        assignedTo: owner.id,
        requirements: l.requirements || null,
        lostReason: "lost" in l ? l.lost : null,
        closedAt: l.status === "won" || l.status === "lost" ? at(-6) : null,
        createdBy: owner.id,
      })
      .returning()
    leadRows.push(row)

    const trail: { type: string; description: string; when: number }[] = [
      { type: "created", description: `Enquiry received via ${l.source.replace("_", " ")}`, when: -18 },
    ]
    if (l.status !== "new") trail.push({ type: "note", description: "Called and understood the requirement", when: -14 })
    if (["quoted", "negotiating", "won", "lost"].includes(l.status))
      trail.push({ type: "status_change", description: "Stage changed to Quoted", when: -10 })
    if (["negotiating", "won"].includes(l.status))
      trail.push({ type: "status_change", description: "Stage changed to Negotiating", when: -7 })
    if (l.status === "won") trail.push({ type: "converted", description: "Converted to a booking", when: -5 })
    if (l.status === "lost") trail.push({ type: "status_change", description: `Marked lost — ${"lost" in l ? l.lost : ""}`, when: -5 })

    const activityRows = await db
      .insert(leadActivities)
      .values(
        trail.map((t) => ({
          leadId: row.id,
          type: t.type,
          description: t.description,
          createdBy: owner.id,
          createdAt: at(t.when, "11:15"),
        }))
      )
      .returning({ id: leadActivities.id })
    track("leadActivities", activityRows.map((r) => r.id))
  }
  track("leads", leadRows.map((r) => r.id))
  const lead = (destination: string, customerName: string) =>
    leadRows.find(
      (l) => l.destination === destination && l.customerId === customer(customerName).id
    )!

  // Follow-ups spread across overdue / today / this week / upcoming / done, so
  // every tab on the queue has something in it.
  const FOLLOWUPS: {
    lead: (typeof leadRows)[number]
    dueOffset: number
    time: string
    channel: "call" | "whatsapp" | "email" | "visit" | "other"
    note: string
    status: "pending" | "done" | "missed"
    outcome?: string
    owner: (typeof salesA)
  }[] = [
    { lead: lead("Wayanad", "Fathima Beevi"), dueOffset: -3, time: "10:00", channel: "call", note: "Confirm the 14-seater rate", status: "missed", owner: salesA },
    { lead: lead("Kovalam & Poovar", "Mohammed Ashraf"), dueOffset: -1, time: "16:30", channel: "whatsapp", note: "Send beachfront options", status: "pending", owner: salesB },
    { lead: lead("Kumarakom", "Sneha Krishnan"), dueOffset: 0, time: "11:00", channel: "call", note: "Follow up on the villa quote", status: "pending", owner: salesA },
    { lead: lead("Athirappilly day trip", "Deepa Nair"), dueOffset: 0, time: "15:00", channel: "call", note: "Confirm headcount for the outing", status: "pending", owner: salesA },
    { lead: lead("Wayanad & Coorg", "Vinod Chandran"), dueOffset: 2, time: "10:30", channel: "email", note: "Share the Coorg extension pricing", status: "pending", owner: salesB },
    { lead: lead("Kerala grand tour", "Priya Suresh"), dueOffset: 4, time: "12:00", channel: "call", note: "Check if the dates are confirmed", status: "pending", owner: salesA },
    { lead: lead("Munnar", "Arun Varghese"), dueOffset: 9, time: "10:00", channel: "whatsapp", note: "Send the revised Munnar quote", status: "pending", owner: salesB },
    { lead: lead("Alleppey houseboat", "Deepa Nair"), dueOffset: 16, time: "11:30", channel: "call", note: "Ask about the 2BHK boat dates", status: "pending", owner: salesA },
    { lead: lead("Munnar & Thekkady", "Anitha Menon"), dueOffset: -12, time: "10:00", channel: "call", note: "Share the Munnar itinerary", status: "done", outcome: "Sent the 3N/4D package, she liked it. Asked for a resort with a play area.", owner: salesA },
    { lead: lead("Kerala grand tour", "George Mathew"), dueOffset: -20, time: "14:00", channel: "visit", note: "Office visit to finalise", status: "done", outcome: "Came to the office, finalised the 7-day circuit and paid the advance.", owner: salesB },
    { lead: lead("Thekkady", "Lakshmi Iyer"), dueOffset: -8, time: "17:00", channel: "call", note: "Check on the Thekkady quote", status: "done", outcome: "Booked directly with the resort. Nothing further.", owner: salesA },
  ]

  const followupRows = await db
    .insert(leadFollowups)
    .values(
      FOLLOWUPS.map((f) => ({
        leadId: f.lead.id,
        dueAt: at(f.dueOffset, f.time),
        channel: f.channel,
        note: f.note,
        status: f.status,
        outcome: f.outcome ?? null,
        assignedTo: f.owner.id,
        completedAt: f.status === "done" ? at(f.dueOffset, f.time) : null,
        completedBy: f.status === "done" ? f.owner.id : null,
        createdBy: f.owner.id,
      }))
    )
    .returning({ id: leadFollowups.id })
  track("leadFollowups", followupRows.map((r) => r.id))

  // Custom quotes, seeded from packages and attached to live enquiries.
  const QUOTES = [
    { source: "Kumarakom Lakeside", lead: lead("Kumarakom", "Sneha Krishnan"), customer: "Sneha Krishnan", title: "Kumarakom honeymoon — Sneha", status: "sent", adult: "19500" },
    { source: "Kerala Grand Tour", lead: lead("Kerala grand tour", "Priya Suresh"), customer: "Priya Suresh", title: "Kerala grand tour — Priya (Bengaluru)", status: "sent", adult: "35500" },
    { source: "Wayanad Weekend", lead: lead("Wayanad", "Fathima Beevi"), customer: "Fathima Beevi", title: "Wayanad for two families — Fathima", status: "sent", adult: "10800" },
    { source: "Munnar & Thekkady", lead: lead("Munnar & Thekkady", "Anitha Menon"), customer: "Anitha Menon", title: "Munnar & Thekkady — Anitha", status: "accepted", adult: "16500" },
    { source: "Alleppey Houseboat", lead: lead("Marari beach", "Sneha Krishnan"), customer: "Sneha Krishnan", title: "Marari & Alleppey — Sneha", status: "rejected", adult: "12500" },
  ] as const

  const quoteRows = []
  for (const q of QUOTES) {
    const source = pkg(q.source)
    const [row] = await db
      .insert(itineraries)
      .values({
        code: await nextQuoteCode(),
        kind: "custom",
        title: q.title,
        shareToken: generateShareToken(),
        isShareEnabled: true,
        leadId: q.lead.id,
        customerId: customer(q.customer).id,
        sourcePackageId: source.id,
        destination: source.destination,
        durationDays: source.durationDays,
        durationNights: source.durationNights,
        summary: source.summary,
        coverImageUrl: source.coverImageUrl,
        pricingMode: "per_pax",
        pricePerAdult: rupees(q.adult),
        pricePerChild: source.pricePerChild,
        inclusions: source.inclusions,
        exclusions: source.exclusions,
        termsAndConditions: source.termsAndConditions,
        status: q.status,
        validUntil: day(45),
        sentAt: at(-9, "17:40"),
        respondedAt: q.status === "sent" ? null : at(-6, "09:10"),
        viewCount: q.status === "sent" ? 3 : 7,
        lastViewedAt: at(-4, "21:05"),
        createdBy: salesA.id,
      })
      .returning()
    quoteRows.push(row)

    // Copy the package's days so the shared quote reads as a complete plan.
    const sourceDays = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, source.id))
    const copied = await db
      .insert(itineraryDays)
      .values(
        sourceDays
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((d) => ({
            itineraryId: row.id,
            dayNumber: d.dayNumber,
            title: d.title,
            description: d.description,
            stayNote: d.stayNote,
            breakfast: d.breakfast,
            lunch: d.lunch,
            dinner: d.dinner,
          }))
      )
      .returning({ id: itineraryDays.id })
    track("itineraryDays", copied.map((r) => r.id))
  }
  track("itineraries", quoteRows.map((r) => r.id))

  // -------------------------------------------------------------- bookings

  interface CostSpec {
    category: (typeof costCategoryEnum.enumValues)[number]
    supplier?: string
    vehicle?: number
    description: string
    quantity: number
    unit: string
    status?: "planned" | "booked" | "cancelled"
    paidFraction?: number
  }

  const BOOKINGS: {
    customer: string
    lead?: (typeof leadRows)[number]
    itinerary?: string
    title: string
    destination: string
    start: number
    end: number
    adults: number
    children: number
    perAdult: string
    perChild: string
    discount: string
    taxPercent: number
    status: "confirmed" | "in_progress" | "completed" | "cancelled"
    owner: typeof salesA
    vehicle: number
    driver: number
    pax: { name: string; age: number; gender: string }[]
    costs: CostSpec[]
    /** Fraction of the grand total already received. */
    received: number
    cancellation?: { reason: string; charge: string }
  }[] = [
    {
      customer: "George Mathew",
      lead: lead("Kerala grand tour", "George Mathew"),
      itinerary: "Kerala Grand Tour",
      title: "Kerala Grand Tour — Mathew family",
      destination: "Kochi, Munnar, Thekkady, Alleppey, Kovalam",
      start: -58, end: -52, adults: 4, children: 0,
      perAdult: "34500", perChild: "0", discount: "6000", taxPercent: 5,
      status: "completed", owner: salesB, vehicle: 0, driver: 0,
      pax: [
        { name: "George Mathew", age: 52, gender: "male" },
        { name: "Susan Mathew", age: 48, gender: "female" },
        { name: "Alan Mathew", age: 24, gender: "male" },
        { name: "Ann Mathew", age: 21, gender: "female" },
      ],
      costs: [
        { category: "hotel", supplier: "Tea Valley Resort", description: "Deluxe rooms × 2 nights", quantity: 4, unit: "6400", status: "booked", paidFraction: 1 },
        { category: "hotel", supplier: "Spice Garden Homestay", description: "Double rooms × 1 night", quantity: 2, unit: "2800", status: "booked", paidFraction: 1 },
        { category: "transport", supplier: "Backwater Palace Houseboat", description: "2BHK houseboat, 1 night", quantity: 1, unit: "18500", status: "booked", paidFraction: 1 },
        { category: "transport", vehicle: 0, description: "Tempo Traveller, 7 days", quantity: 7, unit: "4800", status: "booked", paidFraction: 0.6 },
        { category: "guide", supplier: "Periyar Nature Guides", description: "Nature walk for 4", quantity: 4, unit: "850", status: "booked", paidFraction: 1 },
        { category: "driver_allowance", description: "Driver bata, 7 days", quantity: 7, unit: "800", status: "booked" },
      ],
      received: 1,
    },
    {
      customer: "Rajesh Pillai",
      lead: lead("Alleppey houseboat", "Rajesh Pillai"),
      itinerary: "Alleppey Houseboat",
      title: "Alleppey Houseboat — Rajesh anniversary",
      destination: "Alappuzha",
      start: -24, end: -23, adults: 2, children: 0,
      perAdult: "9500", perChild: "0", discount: "0", taxPercent: 5,
      status: "completed", owner: salesB, vehicle: 1, driver: 1,
      pax: [
        { name: "Rajesh Pillai", age: 36, gender: "male" },
        { name: "Meenakshi Rajesh", age: 33, gender: "female" },
      ],
      costs: [
        { category: "transport", supplier: "Backwater Palace Houseboat", description: "1BHK houseboat, 1 night", quantity: 1, unit: "12000", status: "booked", paidFraction: 1 },
        { category: "transport", vehicle: 1, description: "Innova, Kochi–Alleppey drop and pickup", quantity: 1, unit: "3600", status: "booked", paidFraction: 1 },
      ],
      received: 1,
    },
    {
      customer: "Thomas Kurien",
      lead: lead("Munnar", "Thomas Kurien"),
      itinerary: "Munnar & Thekkady",
      title: "Munnar 2N — Kurien couple",
      destination: "Munnar",
      start: -1, end: 2, adults: 2, children: 0,
      perAdult: "16500", perChild: "0", discount: "1500", taxPercent: 5,
      status: "in_progress", owner: salesB, vehicle: 2, driver: 2,
      pax: [
        { name: "Thomas Kurien", age: 44, gender: "male" },
        { name: "Elizabeth Kurien", age: 41, gender: "female" },
      ],
      costs: [
        { category: "hotel", supplier: "Tea Valley Resort", description: "Deluxe room × 2 nights", quantity: 2, unit: "6400", status: "booked", paidFraction: 0.5 },
        { category: "transport", vehicle: 2, description: "Dzire, 4 days", quantity: 4, unit: "2600", status: "booked" },
        { category: "driver_allowance", description: "Driver bata, 4 days", quantity: 4, unit: "800", status: "booked" },
      ],
      received: 0.6,
    },
    {
      customer: "Anitha Menon",
      lead: lead("Munnar & Thekkady", "Anitha Menon"),
      itinerary: "Munnar & Thekkady",
      title: "Munnar & Thekkady — Menon family",
      destination: "Munnar, Thekkady",
      start: 10, end: 13, adults: 2, children: 1,
      perAdult: "16500", perChild: "8500", discount: "2000", taxPercent: 5,
      status: "confirmed", owner: salesA, vehicle: 1, driver: 1,
      pax: [
        { name: "Anitha Menon", age: 38, gender: "female" },
        { name: "Praveen Menon", age: 41, gender: "male" },
        { name: "Ishaan Menon", age: 9, gender: "male" },
      ],
      costs: [
        { category: "hotel", supplier: "Tea Valley Resort", description: "Deluxe room × 2 nights", quantity: 2, unit: "6400", status: "booked", paidFraction: 0.5 },
        { category: "hotel", supplier: "Spice Garden Homestay", description: "Double room × 1 night", quantity: 1, unit: "2800", status: "planned" },
        { category: "transport", vehicle: 1, description: "Innova, 3 days", quantity: 3, unit: "3600", status: "booked" },
        { category: "activity", supplier: "Periyar Nature Guides", description: "Periyar boat ride × 3", quantity: 3, unit: "850", status: "planned" },
        { category: "driver_allowance", description: "Driver bata, 4 days", quantity: 4, unit: "800", status: "booked" },
      ],
      received: 0.4,
    },
    {
      customer: "Deepa Nair",
      title: "Athirappilly office outing — Deepa",
      destination: "Athirappilly",
      start: 14, end: 14, adults: 8, children: 4,
      perAdult: "0", perChild: "0", discount: "0", taxPercent: 5,
      status: "confirmed", owner: salesA, vehicle: 3, driver: 3,
      pax: [
        { name: "Deepa Nair", age: 34, gender: "female" },
        { name: "Ranjith Kumar", age: 37, gender: "male" },
      ],
      costs: [
        { category: "transport", vehicle: 3, description: "Mini bus, day trip", quantity: 1, unit: "7200", status: "booked" },
        { category: "activity", supplier: "Athirappilly Adventures", description: "Guided falls trek × 12", quantity: 12, unit: "450", status: "planned" },
        { category: "meal", supplier: "Malabar Kitchen", description: "Packed lunch × 12", quantity: 12, unit: "320", status: "planned" },
        { category: "permit", description: "Falls entry tickets × 12", quantity: 12, unit: "80", status: "planned" },
        { category: "driver_allowance", description: "Driver bata, day trip", quantity: 1, unit: "800", status: "booked" },
      ],
      received: 0.3,
    },
    {
      customer: "Fathima Beevi",
      title: "Wayanad — Beevi & Rahman families",
      destination: "Wayanad",
      start: 24, end: 26, adults: 6, children: 2,
      perAdult: "10800", perChild: "6000", discount: "3000", taxPercent: 5,
      status: "confirmed", owner: salesA, vehicle: 0, driver: 4,
      pax: [
        { name: "Fathima Beevi", age: 45, gender: "female" },
        { name: "Abdul Rahman", age: 49, gender: "male" },
      ],
      costs: [
        { category: "hotel", description: "Estate resort, 2 nights × 3 rooms", quantity: 6, unit: "4200", status: "booked", paidFraction: 0.4 },
        { category: "transport", vehicle: 0, description: "Tempo Traveller, 3 days", quantity: 3, unit: "4800", status: "booked" },
        { category: "permit", description: "Edakkal caves entry × 8", quantity: 8, unit: "120", status: "planned" },
        { category: "driver_allowance", description: "Driver bata, 3 days", quantity: 3, unit: "800", status: "booked" },
      ],
      received: 0.25,
    },
    {
      customer: "Sneha Krishnan",
      title: "Kumarakom honeymoon — Sneha & Nikhil",
      destination: "Kumarakom",
      start: 38, end: 40, adults: 2, children: 0,
      perAdult: "19500", perChild: "0", discount: "0", taxPercent: 5,
      status: "confirmed", owner: salesA, vehicle: 4, driver: 0,
      pax: [
        { name: "Sneha Krishnan", age: 29, gender: "female" },
        { name: "Nikhil Menon", age: 31, gender: "male" },
      ],
      costs: [
        { category: "hotel", supplier: "Kumarakom Lake Resort", description: "Lake-view villa × 2 nights", quantity: 2, unit: "11500", status: "booked", paidFraction: 0.5 },
        { category: "transport", vehicle: 4, description: "Scorpio, airport transfers", quantity: 2, unit: "3400", status: "booked" },
      ],
      received: 0.5,
    },
    {
      customer: "Lakshmi Iyer",
      title: "Thekkady 1N — Iyer couple",
      destination: "Thekkady",
      start: 8, end: 9, adults: 2, children: 0,
      perAdult: "8500", perChild: "0", discount: "0", taxPercent: 5,
      status: "cancelled", owner: salesA, vehicle: 5, driver: 4,
      pax: [],
      costs: [
        { category: "hotel", supplier: "Spice Garden Homestay", description: "Double room × 1 night", quantity: 1, unit: "2800", status: "cancelled" },
      ],
      received: 0,
      cancellation: { reason: "Customer booked directly with the resort", charge: "1500" },
    },
  ]

  const invoiceIds: string[] = []
  const receiptIds: string[] = []
  const paymentIds: string[] = []
  const bookingIds: string[] = []
  const paxIds: string[] = []
  const costIds: string[] = []
  const assignmentIds: string[] = []

  for (const b of BOOKINGS) {
    const subtotal = rupees(b.perAdult) * b.adults + rupees(b.perChild) * b.children
    // The office outing is quoted as a lump sum rather than per head.
    const lumpSum = subtotal === 0 ? rupees("29000") : 0
    const totals = computeTotals({
      subtotal: subtotal || lumpSum,
      discount: rupees(b.discount),
      taxRateBps: b.taxPercent * 100,
    })

    const [booking] = await db
      .insert(bookings)
      .values({
        code: await nextBookingCode(new Date(day(b.start))),
        customerId: customer(b.customer).id,
        leadId: b.lead?.id ?? null,
        itineraryId: b.itinerary ? pkg(b.itinerary).id : null,
        title: b.title,
        destination: b.destination,
        startDate: day(b.start),
        endDate: day(b.end),
        adults: b.adults,
        children: b.children,
        infants: 0,
        pricingMode: subtotal === 0 ? "fixed" : "per_pax",
        pricePerAdult: subtotal === 0 ? null : rupees(b.perAdult),
        pricePerChild: subtotal === 0 ? null : rupees(b.perChild),
        sellSubtotal: totals.subtotal,
        discount: totals.discount,
        taxRateBps: totals.taxRateBps,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        status: b.status,
        assignedTo: b.owner.id,
        notes: b.itinerary ? `Based on the ${b.itinerary} package.` : null,
        internalNotes: b.status === "completed" ? "Trip closed, all supplier bills settled." : null,
        cancelledAt: b.cancellation ? at(-3) : null,
        cancellationReason: b.cancellation?.reason ?? null,
        cancellationCharge: b.cancellation ? rupees(b.cancellation.charge) : null,
        completedAt: b.status === "completed" ? at(b.end) : null,
        createdBy: b.owner.id,
      })
      .returning()
    bookingIds.push(booking.id)

    if (b.pax.length) {
      const rows = await db
        .insert(bookingPax)
        .values(
          b.pax.map((p, i) => ({
            bookingId: booking.id,
            name: p.name,
            age: p.age,
            gender: p.gender,
            phone: i === 0 ? customer(b.customer).phone : null,
            idType: "Aadhaar",
            idNumber: `XXXX XXXX ${1000 + i}`,
            isLead: i === 0 ? 1 : 0,
          }))
        )
        .returning({ id: bookingPax.id })
      paxIds.push(...rows.map((r) => r.id))
    }

    // Cost lines, with supplier payments applied to the ones marked paid.
    for (const c of b.costs) {
      const costAmount = rupees(c.unit) * c.quantity
      const paid = Math.round(costAmount * (c.paidFraction ?? 0))
      const [item] = await db
        .insert(tripCostItems)
        .values({
          bookingId: booking.id,
          category: c.category,
          supplierId: c.supplier ? supplier(c.supplier).id : null,
          vehicleId: c.vehicle !== undefined ? vehicleRows[c.vehicle].id : null,
          description: c.description,
          serviceDate: day(b.start),
          quantity: c.quantity,
          unitCost: rupees(c.unit),
          costAmount,
          sellAmount: 0,
          status: c.status ?? "planned",
          paidAmount: paid,
          paymentStatus: paid === 0 ? "unpaid" : paid >= costAmount ? "paid" : "partial",
          confirmationNo: c.supplier ? `CNF-${booking.code.slice(-4)}-${c.category.slice(0, 3).toUpperCase()}` : null,
          createdBy: ops.id,
        })
        .returning()
      costIds.push(item.id)

      if (paid > 0 && c.supplier) {
        const [payment] = await db
          .insert(supplierPayments)
          .values({
            number: await nextSupplierPaymentNumber(new Date(day(b.start - 2))),
            supplierId: supplier(c.supplier).id,
            bookingId: booking.id,
            tripCostItemId: item.id,
            amount: paid,
            mode: "bank_transfer",
            reference: `NEFT${String(2000 + costIds.length)}`,
            paidAt: day(b.start - 2),
            paidBy: accountant.id,
          })
          .returning({ id: supplierPayments.id })
        paymentIds.push(payment.id)
      }
    }

    // Vehicle and driver blocked out for the trip dates.
    const [assignment] = await db
      .insert(vehicleAssignments)
      .values({
        bookingId: booking.id,
        vehicleId: vehicleRows[b.vehicle].id,
        driverId: driverRows[b.driver].id,
        startDate: day(b.start),
        endDate: day(b.end),
        startOdometer: 45000 + bookingIds.length * 1200,
        endOdometer: b.status === "completed" ? 45000 + bookingIds.length * 1200 + 940 : null,
        createdBy: ops.id,
      })
      .returning({ id: vehicleAssignments.id })
    assignmentIds.push(assignment.id)

    if (b.status === "cancelled") continue

    // Invoice mirrors the booking's stored totals — never recomputed.
    const paxLabel = `${b.adults} adult${b.adults === 1 ? "" : "s"}${
      b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""
    }`
    const receivedTotal = Math.round(totals.grandTotal * b.received)
    const [invoice] = await db
      .insert(invoices)
      .values({
        number: await nextInvoiceNumber(new Date(day(b.start - 7))),
        bookingId: booking.id,
        customerId: customer(b.customer).id,
        issueDate: day(b.start - 7),
        dueDate: day(b.start - 1),
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxRateBps: totals.taxRateBps,
        taxAmount: totals.taxAmount,
        total: totals.grandTotal,
        amountPaid: receivedTotal,
        status:
          receivedTotal >= totals.grandTotal
            ? "paid"
            : receivedTotal > 0
              ? "partially_paid"
              : "sent",
        terms: "50% advance on confirmation, balance before departure.",
        createdBy: accountant.id,
      })
      .returning()
    invoiceIds.push(invoice.id)

    const lineRows = await db
      .insert(invoiceLines)
      .values([
        {
          invoiceId: invoice.id,
          description: `${b.title} — ${b.destination} (${paxLabel})`,
          quantity: 1,
          unitPrice: totals.subtotal,
          amount: totals.subtotal,
          sortOrder: 0,
        },
      ])
      .returning({ id: invoiceLines.id })
    track("invoiceLines", lineRows.map((r) => r.id))

    // Advance first, balance later — the split every trip actually has.
    if (receivedTotal > 0) {
      const advance = Math.min(Math.round(totals.grandTotal * 0.4), receivedTotal)
      const balance = receivedTotal - advance
      const plan = [
        { amount: advance, mode: "upi" as const, offset: b.start - 7, isAdvance: true, ref: `UPI${String(78000 + invoiceIds.length)}` },
        ...(balance > 0
          ? [{ amount: balance, mode: "bank_transfer" as const, offset: Math.min(b.start, 0), isAdvance: false, ref: `NEFT${String(91000 + invoiceIds.length)}` }]
          : []),
      ]
      for (const p of plan) {
        const [receipt] = await db
          .insert(receipts)
          .values({
            number: await nextReceiptNumber(new Date(day(p.offset))),
            bookingId: booking.id,
            invoiceId: invoice.id,
            customerId: customer(b.customer).id,
            amount: p.amount,
            mode: p.mode,
            reference: p.ref,
            receivedAt: day(p.offset),
            isAdvance: p.isAdvance,
            receivedBy: accountant.id,
          })
          .returning({ id: receipts.id })
        receiptIds.push(receipt.id)
      }
    }
  }

  track("bookings", bookingIds)
  track("bookingPax", paxIds)
  track("tripCostItems", costIds)
  track("vehicleAssignments", assignmentIds)
  track("invoices", invoiceIds)
  track("receipts", receiptIds)
  track("supplierPayments", paymentIds)

  // -------------------------------------------------------------- expenses

  const categoryRows = await db.select().from(expenseCategories)
  const category = (name: string) => categoryRows.find((c) => c.name === name) ?? null

  const EXPENSES: {
    description: string
    amount: string
    category: string
    offset: number
    mode: "cash" | "upi" | "bank_transfer" | "card"
    booking?: number
    vehicle?: number
    approved?: boolean
  }[] = [
    { description: "Diesel — Kochi to Munnar circuit", amount: "6400", category: "Fuel", offset: -57, mode: "cash", booking: 0, vehicle: 0, approved: true },
    { description: "Tolls, Kochi–Kovalam", amount: "1250", category: "Tolls & parking", offset: -55, mode: "cash", booking: 0, vehicle: 0, approved: true },
    { description: "Driver bata — 7 day circuit", amount: "5600", category: "Driver allowance", offset: -52, mode: "cash", booking: 0, approved: true },
    { description: "Diesel — Alleppey return", amount: "2200", category: "Fuel", offset: -24, mode: "upi", booking: 1, vehicle: 1, approved: true },
    { description: "Houseboat jetty parking", amount: "300", category: "Tolls & parking", offset: -24, mode: "cash", booking: 1, approved: true },
    { description: "Tyre replacement — KL07AB1234", amount: "18400", category: "Vehicle maintenance", offset: -40, mode: "bank_transfer", vehicle: 0, approved: true },
    { description: "Service and oil change — Innova", amount: "7600", category: "Vehicle maintenance", offset: -18, mode: "card", vehicle: 1, approved: true },
    { description: "Diesel — Munnar trip", amount: "3100", category: "Fuel", offset: -1, mode: "upi", booking: 2, vehicle: 2 },
    { description: "Entry tickets, tea museum", amount: "600", category: "Guide & entry tickets", offset: -1, mode: "cash", booking: 2 },
    { description: "Lunch on the road — Kurien trip", amount: "1150", category: "Meals on trip", offset: 0, mode: "cash", booking: 2 },
    { description: "Office rent — this month", amount: "45000", category: "Office rent", offset: -14, mode: "bank_transfer", approved: true },
    { description: "Office rent — last month", amount: "45000", category: "Office rent", offset: -44, mode: "bank_transfer", approved: true },
    { description: "Staff salaries — last month", amount: "243000", category: "Salaries", offset: -44, mode: "bank_transfer", approved: true },
    { description: "Instagram ads — monsoon campaign", amount: "18000", category: "Marketing", offset: -30, mode: "card", approved: true },
    { description: "Google Ads — Kerala packages", amount: "12500", category: "Marketing", offset: -12, mode: "card" },
    { description: "Broadband and phone", amount: "3400", category: "Utilities & internet", offset: -20, mode: "bank_transfer", approved: true },
    { description: "Electricity — office", amount: "4900", category: "Utilities & internet", offset: -35, mode: "upi", approved: true },
    { description: "Printer cartridges and stationery", amount: "2800", category: "Miscellaneous", offset: -8, mode: "cash" },
    { description: "Travel fair stall booking", amount: "25000", category: "Marketing", offset: -60, mode: "bank_transfer", approved: true },
    { description: "Driver uniforms", amount: "6200", category: "Miscellaneous", offset: -50, mode: "cash", approved: true },
    { description: "Diesel — Wayanad recce", amount: "2900", category: "Fuel", offset: -6, mode: "upi", vehicle: 0 },
    { description: "Client hospitality — Mathew family", amount: "1800", category: "Miscellaneous", offset: -52, mode: "cash", booking: 0, approved: true },
  ]

  const expenseIds: string[] = []
  for (const e of EXPENSES) {
    const [row] = await db
      .insert(expenses)
      .values({
        number: await nextExpenseNumber(new Date(day(e.offset))),
        bookingId: e.booking !== undefined ? bookingIds[e.booking] : null,
        vehicleId: e.vehicle !== undefined ? vehicleRows[e.vehicle].id : null,
        categoryId: category(e.category)?.id ?? null,
        description: e.description,
        amount: rupees(e.amount),
        spentAt: day(e.offset),
        mode: e.mode,
        approvedBy: e.approved ? manager.id : null,
        approvedAt: e.approved ? at(e.offset + 1) : null,
        createdBy: ops.id,
      })
      .returning({ id: expenses.id })
    expenseIds.push(row.id)
  }
  track("expenses", expenseIds)

  // ------------------------------------------------------------- manifest

  await db
    .insert(appSettings)
    .values({ key: MANIFEST_KEY, value: made })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: made } })

  const total = Object.values(made).reduce((sum, ids) => sum + ids.length, 0)
  console.log("\nDemo data seeded:\n")
  for (const [table, ids] of Object.entries(made).sort()) {
    console.log(`  ${String(ids.length).padStart(4)}  ${table}`)
  }
  console.log(`\n  ${total} rows total`)
  console.log("\n  Staff logins — password Demo@1234")
  for (const s of STAFF) console.log(`    ${s.username.padEnd(18)} ${s.role}`)
  console.log("\n  Re-run to refresh, or `pnpm db:seed:demo clean` to remove.\n")
}

main().catch((err) => {
  console.error("Demo seed failed:", err)
  process.exit(1)
})
