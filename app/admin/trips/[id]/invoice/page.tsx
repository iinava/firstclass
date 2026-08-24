import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requirePermission } from "@/lib/action"
import { formatDate, formatPax, formatPhone } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { getBookingRaw } from "@/lib/services/booking.service"
import { getCustomer } from "@/lib/services/customer.service"
import { listReceiptsByBooking } from "@/lib/services/accounts.service"
import { COMPANY } from "@/lib/company"
import { PrintButton } from "./_components/print-button"

export const metadata: Metadata = { title: "Invoice" }

/**
 * The whole invoice feature: one printable page rendered straight from the
 * trip's stored totals. No invoice records, no statuses, no numbering — the
 * trip code is the reference, and the browser's "Save as PDF" is the export.
 */
export default async function TripInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission("booking:view")
  const { id } = await params

  const trip = await getBookingRaw(id)
  if (!trip) notFound()

  const [customer, receipts] = await Promise.all([
    getCustomer(trip.customerId),
    listReceiptsByBooking(id),
  ])

  const received = receipts
    .filter((receipt) => !receipt.voidedAt)
    .reduce((sum, receipt) => sum + Number(receipt.amount), 0)
  const balance = trip.grandTotal - received

  return (
    <div className="mx-auto w-full max-w-[820px] p-6 print:p-0">
      <PrintButton />

      <article className="rounded-xl border bg-white p-10 text-black print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-8 border-b border-neutral-300 pb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{COMPANY.name}</h1>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-600">
              {COMPANY.address}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {formatPhone(COMPANY.phone)} · {COMPANY.email}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              GSTIN: {COMPANY.gstin || "NOT SET — update lib/company.ts before sending"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold uppercase tracking-widest">Invoice</p>
            <p className="mt-1 font-mono text-sm">{trip.code}</p>
            <p className="mt-1 text-xs text-neutral-600">
              Date: {formatDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 py-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Billed to
            </p>
            <p className="mt-1.5 font-medium">{customer?.name}</p>
            {customer?.address && (
              <p className="text-xs leading-relaxed text-neutral-600">
                {customer.address}
                {customer.city ? `, ${customer.city}` : ""}
                {customer.state ? `, ${customer.state}` : ""}
                {customer.pincode ? ` ${customer.pincode}` : ""}
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-600">
              {formatPhone(customer?.phone ?? "")}
              {customer?.email ? ` · ${customer.email}` : ""}
            </p>
            {customer?.gstin && (
              <p className="text-xs text-neutral-600">GSTIN: {customer.gstin}</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Trip
            </p>
            <p className="mt-1.5 font-medium">{trip.title}</p>
            <p className="text-xs text-neutral-600">
              {trip.destination ?? "—"} · {formatDate(trip.startDate)} –{" "}
              {formatDate(trip.endDate)}
            </p>
            <p className="text-xs text-neutral-600">
              {formatPax(trip.adults, trip.children, trip.infants)}
            </p>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-neutral-300 text-left">
              <th className="py-2.5 font-semibold">Description</th>
              <th className="py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-3 align-top">
                <p className="font-medium">{trip.title}</p>
                <p className="text-xs text-neutral-600">
                  {trip.destination ? `${trip.destination} · ` : ""}
                  {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                  {formatPax(trip.adults, trip.children, trip.infants)}
                </p>
              </td>
              <td className="py-3 text-right tabular-nums">
                {formatMoney(trip.sellSubtotal)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-64 text-sm">
            <Row label="Subtotal" value={formatMoney(trip.sellSubtotal)} />
            {trip.discount > 0 && (
              <Row label="Discount" value={`− ${formatMoney(trip.discount)}`} />
            )}
            {trip.taxAmount > 0 && (
              <Row
                label={`GST (${trip.taxRateBps / 100}%)`}
                value={formatMoney(trip.taxAmount)}
              />
            )}
            <Row
              label="Total"
              value={formatMoney(trip.grandTotal)}
              className="border-t border-neutral-300 pt-2 font-semibold"
            />
            {received > 0 && (
              <Row label="Received" value={`− ${formatMoney(received)}`} />
            )}
            <Row
              label="Balance due"
              value={formatMoney(balance)}
              className="border-t border-neutral-300 pt-2 text-base font-bold"
            />
          </dl>
        </div>

        {receipts.some((receipt) => !receipt.voidedAt) && (
          <section className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Payments received
            </p>
            <ul className="mt-2 divide-y divide-neutral-200 text-xs">
              {receipts
                .filter((receipt) => !receipt.voidedAt)
                .map((receipt) => (
                  <li key={receipt.id} className="flex justify-between py-1.5">
                    <span>
                      {formatDate(receipt.receivedAt)} · {receipt.number}
                      {receipt.reference ? ` · ${receipt.reference}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(Number(receipt.amount))}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {trip.notes && (
          <section className="mt-8 text-xs leading-relaxed text-neutral-600">
            <p className="font-semibold text-neutral-500">Notes</p>
            <p className="mt-1 whitespace-pre-line">{trip.notes}</p>
          </section>
        )}

        <footer className="mt-10 border-t border-neutral-300 pt-4 text-center text-[11px] text-neutral-500">
          This is a computer-generated invoice and does not require a signature.
        </footer>
      </article>
    </div>
  )
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`flex justify-between py-1 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
