import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { requirePermission } from "@/lib/action"
import { formatDate, formatPax, formatPhone, humanize } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { getBookingRaw } from "@/lib/services/booking.service"
import { getCustomer } from "@/lib/services/customer.service"
import { listReceiptsByBooking } from "@/lib/services/accounts.service"
import { Letterhead } from "@/components/print/letterhead"
import { PrintButton } from "./_components/print-button"

export const metadata: Metadata = { title: "Invoice" }

const NAVY = "text-[var(--brand-navy)]"

/** `humanize` would print "upi" as "Upi" on a document a client keeps. */
const MODE_LABELS: Record<string, string> = { upi: "UPI" }

/**
 * The whole invoice feature: one printable page rendered straight from the
 * trip's stored totals, laid onto the company letterhead. No invoice records,
 * no statuses, no numbering — the trip code is the reference, and the browser's
 * "Save as PDF" is the export.
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

  const settled = receipts.filter((receipt) => !receipt.voidedAt)
  const received = settled.reduce(
    (sum, receipt) => sum + Number(receipt.amount),
    0
  )
  const balance = trip.grandTotal - received

  return (
    <div className="bg-neutral-200 p-6 print:bg-white print:p-0 dark:bg-neutral-900">
      <div className="mx-auto w-[210mm] max-w-full print:w-auto">
        <PrintButton />
      </div>

      <div className="shadow-lg print:shadow-none">
        <Letterhead>
          <header className="flex items-start justify-between gap-8">
            <h1
              className={`${NAVY} text-[17pt] leading-none font-semibold tracking-[0.18em] uppercase`}
            >
              Invoice
            </h1>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-[9pt]">
              <dt className="text-neutral-500">Invoice no.</dt>
              <dd className={`${NAVY} font-semibold`}>{trip.code}</dd>
              <dt className="text-neutral-500">Date</dt>
              <dd>{formatDate(new Date())}</dd>
            </dl>
          </header>

          <div className="mt-1 h-[2pt] w-[18mm] bg-[var(--brand-gold)]" />

          <section className="mt-7 grid grid-cols-2 gap-10">
            <div>
              <h2 className="text-[7.5pt] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                Billed to
              </h2>
              <p className={`${NAVY} mt-1.5 text-[11pt] font-semibold`}>
                {customer?.name}
              </p>
              {customer?.address && (
                <p className="mt-0.5 text-[9pt] leading-snug text-neutral-600">
                  {customer.address}
                  {customer.city ? `, ${customer.city}` : ""}
                  {customer.state ? `, ${customer.state}` : ""}
                  {customer.pincode ? ` ${customer.pincode}` : ""}
                </p>
              )}
              <p className="mt-0.5 text-[9pt] text-neutral-600">
                {formatPhone(customer?.phone ?? "")}
                {customer?.email ? ` · ${customer.email}` : ""}
              </p>
              {customer?.gstin && (
                <p className="text-[9pt] text-neutral-600">
                  GSTIN: {customer.gstin}
                </p>
              )}
            </div>

            <div>
              <h2 className="text-[7.5pt] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                Trip
              </h2>
              <p className={`${NAVY} mt-1.5 text-[11pt] font-semibold`}>
                {trip.title}
              </p>
              <p className="mt-0.5 text-[9pt] leading-snug text-neutral-600">
                {trip.destination ?? "—"}
              </p>
              <p className="text-[9pt] text-neutral-600">
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                {formatPax(trip.adults, trip.children, trip.infants)}
              </p>
            </div>
          </section>

          <table className="mt-8 w-full border-collapse text-[9.5pt]">
            <thead>
              <tr className="bg-[var(--brand-navy)] text-white">
                <th className="px-3 py-2 text-left text-[8pt] font-semibold tracking-[0.1em] uppercase">
                  Description
                </th>
                <th className="px-3 py-2 text-right text-[8pt] font-semibold tracking-[0.1em] uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200">
                <td className="px-3 py-3 align-top">
                  <p className="font-medium">{trip.title}</p>
                  <p className="mt-0.5 text-[8.5pt] text-neutral-600">
                    {trip.destination ? `${trip.destination} · ` : ""}
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                    {formatPax(trip.adults, trip.children, trip.infants)}
                  </p>
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums">
                  {formatMoney(trip.sellSubtotal)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <dl className="w-[72mm] text-[9.5pt]">
              <Row label="Subtotal" value={formatMoney(trip.sellSubtotal)} />
              {trip.discount > 0 && (
                <Row
                  label="Discount"
                  value={`− ${formatMoney(trip.discount)}`}
                />
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
                className="mt-1 border-t border-neutral-300 pt-1.5 font-semibold"
              />
              {received > 0 && (
                <Row label="Received" value={`− ${formatMoney(received)}`} />
              )}
              <div
                className={`${NAVY} mt-1.5 flex items-baseline justify-between border-t-2 border-[var(--brand-gold)] px-1 pt-1.5`}
              >
                <dt className="text-[8pt] font-semibold tracking-[0.1em] uppercase">
                  Balance due
                </dt>
                <dd className="text-[13pt] font-bold tabular-nums">
                  {formatMoney(balance)}
                </dd>
              </div>
            </dl>
          </div>

          {settled.length > 0 && (
            <section className="mt-8 break-inside-avoid">
              <h2 className="text-[7.5pt] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                Payments received
              </h2>
              <ul className="mt-1.5 divide-y divide-neutral-200 text-[8.5pt]">
                {settled.map((receipt) => (
                  <li key={receipt.id} className="flex justify-between py-1.5">
                    <span className="text-neutral-600">
                      {formatDate(receipt.receivedAt)} · {receipt.number} ·{" "}
                      {MODE_LABELS[receipt.mode] ?? humanize(receipt.mode)}
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
            <section className="mt-8 break-inside-avoid text-[8.5pt] leading-relaxed text-neutral-600">
              <h2 className="text-[7.5pt] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                Notes
              </h2>
              <p className="mt-1 whitespace-pre-line">{trip.notes}</p>
            </section>
          )}

          <p className="mt-10 text-center text-[8pt] text-neutral-500">
            This is a computer-generated invoice and does not require a
            signature.
          </p>
        </Letterhead>
      </div>
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
    <div className={`flex justify-between px-1 py-0.5 ${className}`}>
      <dt className="text-neutral-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
