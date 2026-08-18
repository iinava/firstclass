import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Hydrate } from "@/components/shared/hydrate"
import { Skeleton } from "@/components/ui/skeleton"
import { getQueryClient } from "@/lib/query-client"
import { qk } from "@/lib/query-keys"
import { requirePermission } from "@/lib/action"
import {
  getBooking,
  getBookingLedger,
  listTripCosts,
} from "@/lib/services/booking.service"
import { listAssignmentsByBooking } from "@/lib/services/vehicle.service"
import { TripDetail } from "./_components/trip-detail"

export const metadata: Metadata = { title: "Trip" }

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <Suspense fallback={<DetailSkeleton />}>
        <TripLoader params={params} />
      </Suspense>
    </div>
  )
}

async function TripLoader({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("booking:view")
  const { id } = await params

  const trip = await getBooking(id)
  if (!trip) notFound()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qk.bookings.detail(id),
      queryFn: () => getBooking(id),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.bookings.costs(id),
      queryFn: () => listTripCosts(id),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.bookings.ledger(id),
      queryFn: () => getBookingLedger(id),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.vehicles.availability({ bookingId: id }),
      queryFn: () => listAssignmentsByBooking(id),
    }),
  ])

  return (
    <Hydrate client={queryClient}>
      <TripDetail tripId={id} />
    </Hydrate>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
