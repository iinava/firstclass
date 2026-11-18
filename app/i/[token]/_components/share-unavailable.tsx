import { ClockIcon, LockIcon, MessageCircleIcon, PencilRulerIcon } from "lucide-react"
import { FirstClassLogo } from "@/components/print/brand-marks"
import { COMPANY } from "@/lib/company"
import type { UnavailableShareReason } from "@/lib/services/itinerary.service"

const COPY: Record<
  UnavailableShareReason,
  { icon: typeof ClockIcon; title: string; body: string }
> = {
  draft: {
    icon: PencilRulerIcon,
    title: "This itinerary isn't published yet",
    body: "Our team is still putting the finishing touches on it. Please check back soon, or get in touch and we'll send it over the moment it's ready.",
  },
  disabled: {
    icon: LockIcon,
    title: "This link has been turned off",
    body: "Sharing has been paused for this itinerary. Get in touch and we'll send you an up-to-date link.",
  },
  expired: {
    icon: ClockIcon,
    title: "This link has expired",
    body: "Itinerary links are only valid for a limited time. Get in touch and we'll send you a fresh one.",
  },
  closed: {
    icon: LockIcon,
    title: "This itinerary is no longer available",
    body: "It may have been replaced by a newer version. Get in touch and we'll share the latest one.",
  },
}

/**
 * Shown instead of a bare 404 when a share link is real but can't be opened
 * yet (draft) or any more (turned off, expired, removed). Says nothing about
 * the itinerary itself, only why it's unavailable and how to reach us.
 */
export function ShareUnavailable({ reason }: { reason: UnavailableShareReason }) {
  const { icon: Icon, title, body } = COPY[reason]
  const whatsapp = process.env.NEXT_PUBLIC_ENQUIRY_WHATSAPP?.replace(/\D/g, "")

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-neutral-100 px-4 py-12 text-neutral-900">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <FirstClassLogo className="h-14 w-auto" />
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[#1e2b5e]/8 text-[#1e2b5e]">
          <Icon className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-sm leading-relaxed text-pretty text-neutral-600">{body}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white hover:opacity-90"
            >
              <MessageCircleIcon className="size-4" />
              WhatsApp us
            </a>
          )}
          <a
            href={`tel:${COMPANY.phoneHref}`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-neutral-300 px-5 text-sm font-medium hover:bg-neutral-50"
          >
            Call {COMPANY.phone}
          </a>
        </div>
      </div>
    </main>
  )
}
