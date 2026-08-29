import "server-only"
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm"
import { db, txDb, type Tx } from "@/db/drizzle"
import { bookings } from "@/db/schemas/booking.schema"
import { suppliers } from "@/db/schemas/supplier.schema"
import { tripCostItems } from "@/db/schemas/trip-cost.schema"
import {
  drivers,
  vehicleAssignments,
  vehicles,
  type Driver,
  type Vehicle,
  type VehicleAssignment,
} from "@/db/schemas/vehicle.schema"
import type { PaginatedResult } from "@/validations/common.validation"
import type { VehicleListParams } from "@/validations/vehicle.validation"

const alive = isNull(vehicles.deletedAt)

const SORTABLE = {
  regNumber: vehicles.regNumber,
  type: vehicles.type,
  createdAt: vehicles.createdAt,
} as const

export interface VehicleListRow extends Vehicle {
  driverName: string | null
  supplierName: string | null
  tripCount: number
  totalExpense: number
}

export async function listVehicles(
  params: VehicleListParams
): Promise<PaginatedResult<VehicleListRow>> {
  const { page, pageSize, search, sortBy, sortDir, type, ownership, isActive } = params

  const filters = [alive]
  if (search) {
    const term = `%${search}%`
    filters.push(
      or(ilike(vehicles.regNumber, term), ilike(vehicles.make, term), ilike(vehicles.model, term))!
    )
  }
  if (type) filters.push(eq(vehicles.type, type))
  if (ownership) filters.push(eq(vehicles.ownership, ownership))
  if (isActive) filters.push(eq(vehicles.isActive, isActive === "true"))

  const where = and(...filters)
  const column = SORTABLE[sortBy as keyof typeof SORTABLE] ?? vehicles.createdAt
  const order = sortDir === "asc" ? asc(column) : desc(column)

  const rowsPromise = db
    .select({
      id: vehicles.id,
      regNumber: vehicles.regNumber,
      type: vehicles.type,
      make: vehicles.make,
      model: vehicles.model,
      seatingCapacity: vehicles.seatingCapacity,
      ownership: vehicles.ownership,
      supplierId: vehicles.supplierId,
      defaultDriverId: vehicles.defaultDriverId,
      ratePerKm: vehicles.ratePerKm,
      ratePerDay: vehicles.ratePerDay,
      insuranceExpiry: vehicles.insuranceExpiry,
      fitnessExpiry: vehicles.fitnessExpiry,
      pucExpiry: vehicles.pucExpiry,
      isActive: vehicles.isActive,
      notes: vehicles.notes,
      createdBy: vehicles.createdBy,
      createdAt: vehicles.createdAt,
      updatedAt: vehicles.updatedAt,
      deletedAt: vehicles.deletedAt,
      driverName: drivers.name,
      supplierName: suppliers.name,
      tripCount: sql<number>`(
        select count(*)::int from ${vehicleAssignments}
        where ${vehicleAssignments.vehicleId} = "vehicles"."id"
      )`,
      totalExpense: sql<number>`coalesce((
        select sum(${tripCostItems.costAmount}) from ${tripCostItems}
        where ${tripCostItems.vehicleId} = "vehicles"."id"
          and ${tripCostItems.deletedAt} is null
          and ${tripCostItems.status} <> 'cancelled'
      ), 0)::bigint`,
    })
    .from(vehicles)
    .leftJoin(drivers, eq(drivers.id, vehicles.defaultDriverId))
    .leftJoin(suppliers, eq(suppliers.id, vehicles.supplierId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalPromise = db.select({ value: count() }).from(vehicles).where(where)
  const [rows, [{ value: total }]] = await Promise.all([rowsPromise, totalPromise])

  return {
    rows: rows.map((r) => ({ ...r, totalExpense: Number(r.totalExpense) })) as VehicleListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), alive))
    .limit(1)
  return row ?? null
}

export async function getVehicleOptions() {
  return db
    .select({
      id: vehicles.id,
      regNumber: vehicles.regNumber,
      type: vehicles.type,
      seatingCapacity: vehicles.seatingCapacity,
      ownership: vehicles.ownership,
    })
    .from(vehicles)
    .where(and(alive, eq(vehicles.isActive, true)))
    .orderBy(asc(vehicles.regNumber))
    .limit(300)
}

export async function createVehicle(
  values: typeof vehicles.$inferInsert
): Promise<Vehicle> {
  const [row] = await db.insert(vehicles).values(values).returning()
  return row
}

export async function updateVehicle(
  id: string,
  values: Partial<typeof vehicles.$inferInsert>
): Promise<Vehicle | null> {
  const [row] = await db
    .update(vehicles)
    .set(values)
    .where(and(eq(vehicles.id, id), alive))
    .returning()
  return row ?? null
}

export async function softDeleteVehicle(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ value: assigned }] = await db
    .select({ value: count() })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.vehicleId, id))

  if (assigned > 0) {
    return {
      ok: false,
      reason: `This vehicle has ${assigned} trip assignment${assigned === 1 ? "" : "s"}. Mark it inactive instead.`,
    }
  }

  await db
    .update(vehicles)
    .set({ deletedAt: new Date() })
    .where(and(eq(vehicles.id, id), alive))
  return { ok: true }
}

// ------------------------------------------------------------------- drivers

export async function listDrivers(search?: string): Promise<Driver[]> {
  return db
    .select()
    .from(drivers)
    .where(
      and(
        isNull(drivers.deletedAt),
        search ? ilike(drivers.name, `%${search}%`) : undefined
      )
    )
    .orderBy(asc(drivers.name))
    .limit(300)
}

export async function createDriver(
  values: typeof drivers.$inferInsert
): Promise<Driver> {
  const [row] = await db.insert(drivers).values(values).returning()
  return row
}

export async function updateDriver(
  id: string,
  values: Partial<typeof drivers.$inferInsert>
): Promise<Driver | null> {
  const [row] = await db
    .update(drivers)
    .set(values)
    .where(and(eq(drivers.id, id), isNull(drivers.deletedAt)))
    .returning()
  return row ?? null
}

/**
 * Soft delete, refused when the driver is referenced by a trip assignment —
 * mirrors softDeleteVehicle so trip history never points at a vanished driver.
 */
export async function softDeleteDriver(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ value: assigned }] = await db
    .select({ value: count() })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.driverId, id))

  if (assigned > 0) {
    return {
      ok: false,
      reason: `This driver has ${assigned} trip assignment${assigned === 1 ? "" : "s"}. Mark it inactive instead.`,
    }
  }

  await db
    .update(drivers)
    .set({ deletedAt: new Date() })
    .where(eq(drivers.id, id))
  return { ok: true }
}

// --------------------------------------------------------------- assignments

export interface AssignmentConflict {
  bookingCode: string
  startDate: string
  endDate: string
}

/**
 * Two date ranges overlap when each starts before the other ends. Checked
 * before every assignment so the same vehicle can't be promised to two trips —
 * the single most expensive scheduling mistake this business can make.
 */
export async function findAssignmentConflict(
  vehicleId: string,
  startDate: string,
  endDate: string,
  excludeAssignmentId?: string,
  client: Tx | typeof db = db
): Promise<AssignmentConflict | null> {
  const [row] = await client
    .select({
      bookingCode: bookings.code,
      startDate: vehicleAssignments.startDate,
      endDate: vehicleAssignments.endDate,
    })
    .from(vehicleAssignments)
    .innerJoin(bookings, eq(bookings.id, vehicleAssignments.bookingId))
    .where(
      and(
        eq(vehicleAssignments.vehicleId, vehicleId),
        sql`${vehicleAssignments.startDate} <= ${endDate}`,
        sql`${vehicleAssignments.endDate} >= ${startDate}`,
        ne(bookings.status, "cancelled"),
        excludeAssignmentId
          ? ne(vehicleAssignments.id, excludeAssignmentId)
          : undefined
      )
    )
    .limit(1)

  return row ?? null
}

/**
 * Same overlap check as findAssignmentConflict but keyed on the driver —
 * a vehicle can only carry one driver at a time even across different
 * vehicles, so this closes the "same person double-booked on two trips" gap.
 */
export async function findDriverAssignmentConflict(
  driverId: string,
  startDate: string,
  endDate: string,
  excludeAssignmentId?: string,
  client: Tx | typeof db = db
): Promise<AssignmentConflict | null> {
  const [row] = await client
    .select({
      bookingCode: bookings.code,
      startDate: vehicleAssignments.startDate,
      endDate: vehicleAssignments.endDate,
    })
    .from(vehicleAssignments)
    .innerJoin(bookings, eq(bookings.id, vehicleAssignments.bookingId))
    .where(
      and(
        eq(vehicleAssignments.driverId, driverId),
        sql`${vehicleAssignments.startDate} <= ${endDate}`,
        sql`${vehicleAssignments.endDate} >= ${startDate}`,
        ne(bookings.status, "cancelled"),
        excludeAssignmentId
          ? ne(vehicleAssignments.id, excludeAssignmentId)
          : undefined
      )
    )
    .limit(1)

  return row ?? null
}

export async function listAssignmentsByBooking(bookingId: string) {
  return db
    .select({
      id: vehicleAssignments.id,
      vehicleId: vehicleAssignments.vehicleId,
      regNumber: vehicles.regNumber,
      vehicleType: vehicles.type,
      driverId: vehicleAssignments.driverId,
      driverName: drivers.name,
      driverPhone: drivers.phone,
      startDate: vehicleAssignments.startDate,
      endDate: vehicleAssignments.endDate,
      startOdometer: vehicleAssignments.startOdometer,
      endOdometer: vehicleAssignments.endOdometer,
      notes: vehicleAssignments.notes,
    })
    .from(vehicleAssignments)
    .innerJoin(vehicles, eq(vehicles.id, vehicleAssignments.vehicleId))
    .leftJoin(drivers, eq(drivers.id, vehicleAssignments.driverId))
    .where(eq(vehicleAssignments.bookingId, bookingId))
    .orderBy(asc(vehicleAssignments.startDate))
}

export async function createAssignment(
  values: typeof vehicleAssignments.$inferInsert,
  client: Tx | typeof db = db
): Promise<VehicleAssignment> {
  const [row] = await client.insert(vehicleAssignments).values(values).returning()
  return row
}

/**
 * Locks the vehicle's row for the lifetime of the transaction so two
 * concurrent assignVehicle calls for the same vehicle serialize instead of
 * both passing findAssignmentConflict before either has committed.
 */
async function lockVehicle(tx: Tx, vehicleId: string): Promise<void> {
  await tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).for("update")
}

async function lockDriver(tx: Tx, driverId: string): Promise<void> {
  await tx.select({ id: drivers.id }).from(drivers).where(eq(drivers.id, driverId)).for("update")
}

/**
 * Transaction-wrapped assignVehicle: locks the vehicle (and driver, if one is
 * given) row, re-checks for a date-range conflict on both, then inserts —
 * closes the double-booking race where two concurrent requests both pass the
 * conflict check before either commits, for the vehicle and the driver alike.
 */
export async function assignVehicleAtomic(
  values: typeof vehicleAssignments.$inferInsert & {
    vehicleId: string
    startDate: string
    endDate: string
  }
): Promise<
  | { ok: true; assignment: VehicleAssignment }
  | { ok: false; conflictType: "vehicle" | "driver"; conflict: AssignmentConflict }
> {
  return txDb.transaction(async (tx) => {
    await lockVehicle(tx, values.vehicleId)
    if (values.driverId) await lockDriver(tx, values.driverId)

    const conflict = await findAssignmentConflict(
      values.vehicleId,
      values.startDate,
      values.endDate,
      undefined,
      tx
    )
    if (conflict) return { ok: false, conflictType: "vehicle", conflict }

    if (values.driverId) {
      const driverConflict = await findDriverAssignmentConflict(
        values.driverId,
        values.startDate,
        values.endDate,
        undefined,
        tx
      )
      if (driverConflict) return { ok: false, conflictType: "driver", conflict: driverConflict }
    }

    const assignment = await createAssignment(values, tx)
    return { ok: true, assignment }
  })
}

/**
 * Reassigning a driver on an existing assignment can create the same
 * double-booking findDriverAssignmentConflict guards against on create, so
 * re-check it here using the assignment's own (unchanged) date range.
 */
export async function updateAssignment(
  id: string,
  values: Partial<typeof vehicleAssignments.$inferInsert>
): Promise<
  | { ok: true; assignment: VehicleAssignment }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; conflict: AssignmentConflict }
> {
  if (values.driverId) {
    const [existing] = await db
      .select({ startDate: vehicleAssignments.startDate, endDate: vehicleAssignments.endDate })
      .from(vehicleAssignments)
      .where(eq(vehicleAssignments.id, id))
      .limit(1)

    if (!existing) return { ok: false, reason: "not_found" }

    const conflict = await findDriverAssignmentConflict(
      values.driverId,
      existing.startDate,
      existing.endDate,
      id
    )
    if (conflict) return { ok: false, reason: "conflict", conflict }
  }

  const [row] = await db
    .update(vehicleAssignments)
    .set(values)
    .where(eq(vehicleAssignments.id, id))
    .returning()
  return row ? { ok: true, assignment: row } : { ok: false, reason: "not_found" }
}

export async function deleteAssignment(id: string): Promise<VehicleAssignment | null> {
  const [row] = await db
    .delete(vehicleAssignments)
    .where(eq(vehicleAssignments.id, id))
    .returning()
  return row ?? null
}
