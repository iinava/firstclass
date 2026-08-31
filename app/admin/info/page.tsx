import type { Metadata } from "next"
import { Fragment } from "react"
import {
  BanknoteIcon,
  BriefcaseIcon,
  BusIcon,
  CalculatorIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
  CheckIcon,
  CircleHelpIcon,
  CompassIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  MapIcon,
  MapPinnedIcon,
  PlayCircleIcon,
  ReceiptIcon,
  ShieldIcon,
  Store,
  UserRoundCheckIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { humanize } from "@/lib/format"
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "User Manual",
  description:
    "How every screen works, what each field means, and how the money is calculated.",
}

/**
 * A static, hand-maintained user manual. It reads no data — when a screen or a
 * field changes, the matching section here has to be updated by hand.
 */

type Video = { title: string; description: string; url: string }

/**
 * Newest first — a viewer who watches the tour then the updates is caught up.
 * Empty until a walkthrough is recorded; the card is hidden while it is.
 */
const VIDEOS: Video[] = [
  {
    title: "Demo video",
    description: "A recorded walkthrough of the system, covering enquiries through trips.",
    url: "https://drive.google.com/drive/folders/1JWZcs0I8cSRVsp5wUVXa8Mg8CObLdTG2?usp=sharing",
  },
]

type SectionMeta = {
  id: string
  title: string
  icon: typeof CompassIcon
  summary: string
}

const SECTIONS: SectionMeta[] = [
  { id: "basics", title: "The basics", icon: CompassIcon, summary: "Signing in, the sidebar, and habits that apply on every screen." },
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboardIcon, summary: "The four tiles, the trend chart, and today's departures." },
  { id: "enquiries", title: "Enquiries", icon: BriefcaseIcon, summary: "Logging an enquiry, its stages, and who it belongs to." },
  { id: "followups", title: "Follow-ups", icon: CalendarCheckIcon, summary: "The call-back queue and how completing one moves the enquiry." },
  { id: "customers", title: "Customers", icon: UsersIcon, summary: "The address book, and why a phone number can only appear once." },
  { id: "packages", title: "Packages", icon: MapIcon, summary: "Building an itinerary, publishing it, and the customer's link." },
  { id: "trips", title: "Trips", icon: MapPinnedIcon, summary: "Pricing a confirmed trip, its statuses, and cancelling one." },
  { id: "costing", title: "Trip costing", icon: CalculatorIcon, summary: "Cost lines, vehicle assignment, and the profit breakdown." },
  { id: "suppliers", title: "Suppliers", icon: Store, summary: "Who you buy from, and their rate cards." },
  { id: "fleet", title: "Fleet", icon: BusIcon, summary: "Vehicles, drivers, papers, and date clashes." },
  { id: "payments", title: "Payments", icon: WalletIcon, summary: "Recording a receipt, the outstanding list, and voiding." },
  { id: "expenses", title: "Expenses", icon: ReceiptIcon, summary: "Overheads and trip spend, and what approval locks." },
  { id: "reports", title: "Reports", icon: ChartNoAxesCombinedIcon, summary: "Profit and loss, and the five breakdowns." },
  { id: "team", title: "Employees, attendance & leave", icon: UserRoundCheckIcon, summary: "Staff records, the daily register, and recording leave." },
  { id: "payroll", title: "Payroll", icon: BanknoteIcon, summary: "How salaries are worked out from the register, and posting a month." },
  { id: "system", title: "Users & settings", icon: ShieldIcon, summary: "Logins, roles, passwords, and letterhead details." },
  { id: "money", title: "Money glossary", icon: BanknoteIcon, summary: "Every amount field, and how profit is worked out." },
  { id: "roles", title: "Who can see what", icon: ShieldIcon, summary: "The seven roles and what each one gets." },
  { id: "not-yet", title: "Not in the app yet", icon: WrenchIcon, summary: "Recorded in the database but with no screen of its own." },
  { id: "faq", title: "Common questions", icon: CircleHelpIcon, summary: "Why a number looks wrong, and why something was refused." },
]

/** Looked up by id rather than by index, so inserting a section can't misfile one. */
function section(id: string): SectionMeta {
  const found = SECTIONS.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown manual section: ${id}`)
  return found
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: SectionMeta & { children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="size-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-foreground">{children}</h3>
}

/** A numbered walkthrough. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {i + 1}
          </span>
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="select-none">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** A field-by-field reference, e.g. for a form. */
function Fields({ rows }: { rows: { name: string; note: React.ReactNode }[] }) {
  return (
    <dl className="divide-y rounded-md border">
      {rows.map((row) => (
        <div key={row.name} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-4">
          <dt className="font-medium">{row.name}</dt>
          <dd className="text-muted-foreground">{row.note}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Something easy to get wrong — called out so it isn't lost in a paragraph. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-muted-foreground">
      {children}
    </p>
  )
}

const LEAD_STAGES = [
  "New",
  "Contacted",
  "Quoted",
  "Negotiating",
  "Won",
  "Lost",
]

const TRIP_STATUSES = ["Confirmed", "In progress", "Completed", "Cancelled"]

const COST_CATEGORIES = [
  "Hotel",
  "Transport",
  "Flight",
  "Train",
  "Guide",
  "Activity",
  "Meals",
  "Permits",
  "Driver allowance",
  "Fuel",
  "Tolls & parking",
  "Miscellaneous",
]

const ROLES: { name: string; sees: string }[] = [
  {
    name: "Super Admin",
    sees:
      "Everything, including creating and deactivating user accounts and approving leave.",
  },
  {
    name: "Admin",
    sees:
      "Everything operational, including approving leave. Cannot manage user accounts.",
  },
  {
    name: "Manager",
    sees:
      "All of Sales, Operations and Accounts, plus Employees and Attendance. Assigns enquiries, cancels trips, publishes packages, approves expenses and records leave — but does not decide leave.",
  },
  {
    name: "Accounts",
    sees:
      "Payments, Expenses and the financial reports. Read-only on trips, suppliers and fleet; can edit and approve expenses and cost amounts.",
  },
  {
    name: "Sales",
    sees:
      "Enquiries, Customers, Packages and Trips — and only the enquiries assigned to them. No Payments, Expenses or Reports.",
  },
  {
    name: "Operations",
    sees:
      "Every trip, Suppliers, Fleet and trip costing. Can log expenses but not approve them, and cannot open the financial reports.",
  },
  {
    name: "Staff",
    sees: "Read-only on Customers, Enquiries, Packages and Trips.",
  },
]

/**
 * Display order and grouping for the permission matrix below — built from
 * `PERMISSIONS`/`ROLE_PERMISSIONS` in lib/rbac.ts rather than typed out by
 * hand, so it can never drift from what the server actually enforces.
 */
const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customer: "Customers",
  lead: "Enquiries",
  itinerary: "Packages",
  booking: "Trips",
  supplier: "Suppliers",
  vehicle: "Fleet",
  cost: "Trip costing",
  payment: "Payments",
  expense: "Expenses",
  hrms: "Employee records",
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
  report: "Reports",
  user: "User accounts",
  settings: "Settings",
  audit: "Audit log",
}

const ROLE_ORDER = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]

const PERMISSION_GROUPS: { resource: string; permissions: (typeof PERMISSIONS)[number][] }[] =
  (() => {
    const order: string[] = []
    const byResource = new Map<string, (typeof PERMISSIONS)[number][]>()
    for (const permission of PERMISSIONS) {
      const resource = permission.split(":")[0]
      if (!byResource.has(resource)) {
        order.push(resource)
        byResource.set(resource, [])
      }
      byResource.get(resource)!.push(permission)
    }
    return order.map((resource) => ({
      resource: RESOURCE_LABELS[resource] ?? humanize(resource),
      permissions: byResource.get(resource)!,
    }))
  })()

export default function InfoPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CompassIcon className="size-6" />
          User Manual
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What every screen does, what each field means, and how the money is
          calculated.
        </p>
      </div>

      {/* How a trip moves through the system — the one thing worth reading first. */}
      <Card>
        <CardHeader>
          <CardTitle>Start here: how a trip moves through the system</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            Almost all work follows one path, and the sidebar is roughly in that
            order. Each step hands its data to the next, so nothing is retyped.
          </p>
          <Steps
            items={[
              <>
                An enquiry comes in and is logged in <strong>Enquiries</strong>.
                The customer record is created — or matched on the phone number —
                in the same form.
              </>,
              <>
                <strong>Follow-ups</strong> keep it moving until the customer
                decides.
              </>,
              <>
                A quote is built in <strong>Packages</strong>, published, and sent
                as a link the customer opens without logging in.
              </>,
              <>
                They say yes, and the enquiry is converted into a{" "}
                <strong>Trip</strong> — which marks the enquiry Won by itself.
              </>,
              <>
                Cost lines and a vehicle go onto the trip; receipts are recorded
                against it in <strong>Payments</strong>, and other spend in{" "}
                <strong>Expenses</strong>.
              </>,
              <>
                <strong>Reports</strong> show what the trip, the month and the
                staff actually made.
              </>,
            ]}
          />
        </CardContent>
      </Card>

      {/* Videos, once any exist. */}
      {VIDEOS.length > 0 && (
        <Card>
          <CardContent className="divide-y">
            {VIDEOS.map((video, i) => (
              <div
                key={video.url}
                className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PlayCircleIcon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{video.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {video.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant={i === 0 ? "default" : "secondary"}
                  className="shrink-0"
                  render={
                    <a href={video.url} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <PlayCircleIcon data-icon="inline-start" />
                  Watch the video
                  <ExternalLinkIcon data-icon="inline-end" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contents */}
      <Card>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
            >
              <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.summary}
                </span>
              </span>
            </a>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ basics */}
      <Section {...section("basics")}>
        <div className="flex flex-col gap-3">
          <SubHeading>Signing in and out</SubHeading>
          <p className="text-muted-foreground">
            Every screen requires a sign-in, and you sign in with a{" "}
            <strong>username</strong> — not an email address. Your session lasts
            until it expires or you sign out; use the menu on your name at the
            bottom of the sidebar when you are done on a shared computer. If an
            administrator deactivates your account you are signed out and told
            why.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Getting around</SubHeading>
          <Bullets
            items={[
              <>
                The <strong>sidebar</strong> holds every module, grouped Overview,
                Sales, Operations, Accounts, Team and System. The button beside
                the company name collapses it when you need more room.
              </>,
              <>
                <strong>You only see what your role allows.</strong> Modules you
                cannot use are hidden rather than shown greyed out, so two people
                on the same system can have quite different sidebars — see{" "}
                <a href="#roles" className="underline hover:text-foreground">
                  Who can see what
                </a>
                .
              </>,
              <>
                Clicking <strong>First Class</strong> at the top of the sidebar
                returns you to the Dashboard.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Habits that work everywhere</SubHeading>
          <Bullets
            items={[
              <>
                <strong>Search and filters live in the address bar.</strong> Once
                you have filtered a list, the page URL describes exactly that
                view — bookmark it, or send the link to a colleague and they see
                the same thing. A stale or hand-edited filter is dropped rather
                than breaking the page.
              </>,
              <>
                <strong>Lists are paged</strong> — 25 rows at a time by default,
                and up to 100.
              </>,
              <>
                <strong>Adding and editing happens in a pop-up.</strong> Nothing
                is saved until you press the save button, and a short message
                appears in the corner to confirm it worked. If something failed
                validation, the specific problem is shown in red under the field.
              </>,
              <>
                <strong>Deleting always asks first, and can be refused.</strong>{" "}
                Records that other data points at cannot be removed; most things
                are deactivated or cancelled instead, so history survives.
              </>,
              <>
                <strong>Amounts are typed as you would say them.</strong> 12,500
                and 12500.50 both work — commas are ignored, and everything is
                stored to the paise so totals never drift. Negative amounts are
                refused.
              </>,
              <>
                <strong>Phone numbers are Indian mobiles</strong> — ten digits
                starting 6–9, with an optional +91. Spaces and dashes are
                stripped for you.
              </>,
              <>
                <strong>Document numbers are issued, never typed.</strong> Trip
                codes, receipt numbers, expense numbers and employee codes are
                generated automatically, and the money series restart each
                financial year (April to March).
              </>,
              <>
                <strong>Everything is on the record.</strong> Creates, edits,
                cancellations and approvals are stored with who did them and when.
              </>,
            ]}
          />
        </div>
      </Section>

      {/* --------------------------------------------------------- dashboard */}
      <Section {...section("dashboard")}>
        <p className="text-muted-foreground">
          The opening screen — where the business stands today. Sales staff see
          it scoped to their own trips; managers and above see everything.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>The four tiles</SubHeading>
          <Fields
            rows={[
              {
                name: "Enquiries open",
                note: "Enquiries not yet Won or Lost, with how many arrived this month underneath.",
              },
              {
                name: "Calls to make",
                note: "Follow-ups due today plus anything already overdue. It turns red when something is late — this is the tile to act on first.",
              },
              {
                name: "Trips running",
                note: "Confirmed and in-progress trips, with how many are travelling right now.",
              },
              {
                name: "Booked this month",
                note: "The value booked this month, with the value still on the road underneath.",
              },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Below the tiles</SubHeading>
          <Bullets
            items={[
              <>
                The <strong>revenue trend</strong> chart plots month by month. It
                is money, so it only appears for roles that can open the financial
                reports — Sales and Operations see the rest of the page without
                it.
              </>,
              <>
                <strong>Upcoming departures</strong> — the next trips to leave,
                with customer and date.
              </>,
              <>
                <strong>Recent enquiries</strong> — what has just come in.
              </>,
            ]}
          />
        </div>
      </Section>

      {/* --------------------------------------------------------- enquiries */}
      <Section {...section("enquiries")}>
        <p className="text-muted-foreground">
          The pipeline. One record per person who has asked about a trip, from
          the first phone call to Won or Lost. Each one gets a code like{" "}
          <strong>LEAD-000123</strong>.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>Logging one while they are on the phone</SubHeading>
          <p className="text-muted-foreground">
            Start by choosing <strong>New customer</strong> or{" "}
            <strong>Existing customer</strong>. New customer takes a name and
            phone number and creates the record for you. Existing customer opens
            a search box — type a name or number and pick from the matches
            instead of retyping someone already in the book.
          </p>
          <Fields
            rows={[
              {
                name: "Customer name, Phone",
                note: "Shown for New customer. Both required — the phone number is what a future search matches on.",
              },
              {
                name: "Destinations",
                note: "One or more rows, each a place and how many days there — press the + button to add another. Munnar (2 days), then Alleppey (1 day), for example, rather than one free-text line.",
              },
              {
                name: "Travel date, Duration",
                note: "Both optional at this stage. Duration is in days, up to 365.",
              },
              {
                name: "Adults, Children",
                note: "At least one adult. Used later as the starting party size on the quote.",
              },
              { name: "Budget", note: "Optional — what they said they want to spend." },
              {
                name: "Priority",
                note: "Low, Medium or High. Yours to use as a work queue; nothing is calculated from it.",
              },
              {
                name: "Source",
                note: "Walk-in, phone call, referral, Instagram, WhatsApp, Facebook, website, repeat customer or other. This is what the source breakdown reports read.",
              },
              {
                name: "Assigned to",
                note: "Whose enquiry it is. Left empty it stays with whoever logged it.",
              },
              {
                name: "Requirements",
                note: "The long free-text note — rooms, food, anything they asked for.",
              },
              {
                name: "First follow-up",
                note: "Optional date, time and note. Scheduling it here is the difference between an enquiry that gets chased and one that goes quiet.",
              },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Stages</SubHeading>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STAGES.map((stage) => (
              <Badge key={stage} variant="secondary">
                {stage}
              </Badge>
            ))}
          </div>
          <Bullets
            items={[
              <>
                Move the stage from the enquiry itself, or as part of completing a
                follow-up.
              </>,
              <>
                Marking one <strong>Lost</strong> requires a reason — the form
                will not save without one, which is what keeps the pipeline
                honest.
              </>,
              <>
                <strong>Won</strong> is set for you when the enquiry is converted
                into a trip — and converting takes you straight to that new
                trip&apos;s page, not back to the enquiry list.
              </>,
              <>
                Every stage change, assignment and follow-up outcome is written to
                the enquiry&apos;s <strong>activity trail</strong>.
              </>,
            ]}
          />
        </div>

        <Note>
          Sales consultants see only the enquiries assigned to them. Managers and
          above see the whole pipeline and can reassign. If a consultant says an
          enquiry has vanished, it was almost certainly reassigned — not deleted.
        </Note>

        <Note>
          <strong>Won enquiries drop off the list by default</strong> once they
          have become a trip — there is nothing left to do with them here. Pick{" "}
          <strong>Won</strong> in the stage filter to see them again.
        </Note>
      </Section>

      {/* --------------------------------------------------------- followups */}
      <Section {...section("followups")}>
        <p className="text-muted-foreground">
          The call-back queue: dated reminders attached to enquiries. This is the
          screen the sales day starts on.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>The buckets</SubHeading>
          <Fields
            rows={[
              { name: "Overdue", note: "Due before today and still not done. Clear these first." },
              { name: "Today", note: "Due today — the default view when you open the screen." },
              { name: "This week", note: "Everything due in the current week." },
              { name: "Upcoming", note: "Dated later than that." },
              { name: "All", note: "The whole list regardless of date." },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Scheduling one</SubHeading>
          <Fields
            rows={[
              { name: "Due at", note: "Date and time. Required — a follow-up with no date is just a note." },
              {
                name: "Channel",
                note: "Call, WhatsApp, Email, Visit or Other. Shown on the queue so you know how you meant to reach them.",
              },
              { name: "Note", note: "What this call is for — e.g. \"share the Coorg extension pricing\"." },
              { name: "Assigned to", note: "Who makes the call. Defaults to the enquiry's owner." },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Completing one</SubHeading>
          <p className="text-muted-foreground">
            Completing a follow-up does three jobs in one dialog, which is why it
            is worth doing properly rather than just ticking it off:
          </p>
          <Steps
            items={[
              <>
                <strong>Outcome</strong> — required. What was actually said. This
                lands on the enquiry&apos;s activity trail.
              </>,
              <>
                <strong>Next follow-up</strong> — optional date and note, chaining
                the next call-back immediately so the enquiry is never left
                without one.
              </>,
              <>
                <strong>Move the enquiry</strong> — optionally set its new stage
                at the same time, e.g. Contacted to Quoted.
              </>,
            ]}
          />
          <p className="text-muted-foreground">
            A follow-up is Pending, Done, Missed or Cancelled. The Dashboard
            &quot;Calls to make&quot; tile counts the pending ones due today and
            overdue.
          </p>
        </div>
      </Section>

      {/* --------------------------------------------------------- customers */}
      <Section {...section("customers")}>
        <p className="text-muted-foreground">
          The address book — one record per traveller or family, reused across
          every trip they take. In normal use you rarely add anyone here, because
          logging an enquiry does it for you.
        </p>

        <Fields
          rows={[
            { name: "Name", note: "Required, up to 120 characters." },
            {
              name: "Phone",
              note: "Required, and unique across the whole system. A second attempt with the same number is refused rather than splitting one family's history across two records.",
            },
            { name: "Alternate phone", note: "Optional second number, same format." },
            { name: "Email", note: "Optional, validated if given." },
            { name: "Address, City, State, Pincode", note: "All optional. City is a filter on the list." },
            {
              name: "Source",
              note: "How they found you — the same list as on an enquiry.",
            },
            { name: "GSTIN", note: "For customers who need their number on the invoice." },
            { name: "Notes", note: "Anything worth knowing next time they call." },
          ]}
        />

        <Note>
          A customer who has a trip <strong>cannot be deleted</strong>. Deleting
          one that can be removed archives the record rather than erasing it, so
          it stays available to reports and history.
        </Note>
      </Section>

      {/* ---------------------------------------------------------- packages */}
      <Section {...section("packages")}>
        <p className="text-muted-foreground">
          Itineraries. The same screen holds two things: reusable{" "}
          <strong>packages</strong> you sell repeatedly (coded{" "}
          <strong>PKG-000123</strong>), and one-off <strong>custom quotes</strong>{" "}
          for a specific enquiry (coded <strong>QUO-000123</strong>).
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>The itinerary itself</SubHeading>
          <Fields
            rows={[
              { name: "Kind", note: "Package or Custom quote. A custom quote can be tied to an enquiry and a customer." },
              { name: "Title", note: "Required — what the customer will see at the top of the page." },
              { name: "Destination", note: "Free text." },
              { name: "Duration", note: "Days (at least 1, up to 90) and nights." },
              { name: "Summary", note: "The paragraph under the title on the shared page." },
              { name: "Cover image", note: "Uploaded, and used as the picture on the catalogue and the shared page." },
              {
                name: "Pricing",
                note: "Per head (a price per adult and per child) or one fixed package price. This is what the shared page displays; the trip is priced again when it is confirmed.",
              },
              { name: "Inclusions, Exclusions", note: "One line per bullet. These become the two lists on the shared page." },
              { name: "Terms and conditions", note: "Long free text, shown at the bottom of the shared page." },
              { name: "Valid until", note: "Optional expiry date for the quote." },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Days and photos</SubHeading>
          <Bullets
            items={[
              <>
                Add a <strong>day</strong> at a time: day number, title,
                description, an <strong>overnight stay</strong> picked from your
                hotel/homestay/resort suppliers — not typed — with an optional
                note for the room type, and which meals are included — breakfast,
                lunch, dinner. Not in the supplier list yet? Add it under{" "}
                <a href="#suppliers" className="underline hover:text-foreground">
                  Suppliers
                </a>{" "}
                first.
              </>,
              <>
                Upload <strong>photos</strong> against the itinerary or against a
                particular day, each with an optional caption and a sort order.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Statuses and sharing</SubHeading>
          <Fields
            rows={[
              { name: "Draft", note: "Being worked on. Not visible to anyone outside." },
              { name: "Published", note: "Ready to share. Publishing needs the Manager or Admin permission." },
              { name: "Sent", note: "You have given the customer the link." },
              { name: "Accepted / Rejected", note: "What the customer decided. Accepted is the one you convert into a trip." },
              { name: "Archived", note: "Retired, kept for reference." },
            ]}
          />
          <Steps
            items={[
              <>Publish the itinerary.</>,
              <>
                Copy the <strong>share link</strong> and send it. The customer
                opens a read-only page — no login, no prices they should not see,
                and the enquire button dials your WhatsApp number if one is
                configured.
              </>,
              <>
                Switch <strong>sharing off</strong> to take the page down, or{" "}
                <strong>regenerate the link</strong> to kill the old URL and issue
                a new one. Views are counted, so you can tell whether they have
                actually looked at it.
              </>,
            ]}
          />
          <p className="text-muted-foreground">
            Published packages also appear together on the public catalogue page,
            which is a link you can put in a bio or a broadcast.
          </p>
        </div>

        <Note>
          Do not retype an itinerary to quote a variation. Use{" "}
          <strong>Clone</strong> — it copies the whole thing, days and all, into a
          fresh custom quote you can attach to the enquiry and then edit.
        </Note>
      </Section>

      {/* ------------------------------------------------------------- trips */}
      <Section {...section("trips")}>
        <p className="text-muted-foreground">
          A confirmed trip, and the centre of the whole system — costing,
          vehicles, receipts and expenses all hang off it. Each one is coded by
          financial year, e.g. <strong>FC-26-27-000123</strong>.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>Creating one</SubHeading>
          <p className="text-muted-foreground">
            Either <strong>convert an enquiry</strong> — which carries the
            customer, party size and accepted quote across and marks the enquiry
            Won — or create one directly for a customer who rang up and booked.
          </p>
          <Fields
            rows={[
              {
                name: "Customer",
                note: "Required — searched and picked, the same way as everywhere else in the app. A trip always belongs to someone.",
              },
              {
                name: "Package",
                note: "Optional. Pick one and its day-by-day plan — hotels and all — is copied onto this trip as a starting point, editable from there without touching the original package. Leave it unset for a custom trip with no template.",
              },
              { name: "Trip name", note: "Required — what everyone will call it, e.g. \"Munnar & Thekkady 4N\"." },
              { name: "Destination", note: "Free text." },
              {
                name: "Start and end date",
                note: "The end date cannot be before the start date. These are the dates a vehicle gets assigned for.",
              },
              {
                name: "Adults, Children, Infants",
                note: "At least one adult. Infants are counted on the manifest but never priced.",
              },
              {
                name: "Pricing mode",
                note: "Per head — enter a price per adult and per child, and the subtotal is worked out from the party size. Or Fixed — enter one package price.",
              },
              { name: "Discount", note: "Taken off the subtotal before tax. Cannot exceed the subtotal." },
              {
                name: "GST %",
                note: "0 to 50, entered as a percentage. Applied to the amount after discount.",
              },
              { name: "Assigned to", note: "Which consultant owns the trip. Defaults to you." },
              {
                name: "Notes / Internal notes",
                note: "Notes are about the trip; internal notes are for your own staff.",
              },
            ]}
          />
          <p className="text-muted-foreground">
            The totals are worked out once and <strong>stored on the trip</strong>
            , so nothing recalculates behind your back later. See{" "}
            <a href="#money" className="underline hover:text-foreground">
              Money glossary
            </a>{" "}
            for the exact arithmetic.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Statuses</SubHeading>
          <div className="flex flex-wrap gap-1.5">
            {TRIP_STATUSES.map((status) => (
              <Badge key={status} variant="secondary">
                {status}
              </Badge>
            ))}
          </div>
          <Bullets
            items={[
              <>
                Move Confirmed to <strong>In progress</strong> when they leave, and
                to <strong>Completed</strong> when they are back.
              </>,
              <>
                <strong>Cancelling</strong> requires a reason, and takes an
                optional cancellation charge — the non-refundable amount you are
                keeping.
              </>,
              <>
                A <strong>cancelled trip cannot be edited</strong>. Nothing more
                can be changed on it, which is the point.
              </>,
              <>
                A trip with money received against it{" "}
                <strong>cannot be deleted</strong>. Cancel it instead.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Day-by-day itinerary</SubHeading>
          <p className="text-muted-foreground">
            The trip page has its own <strong>Itinerary</strong> tab — a day-by-day
            plan for this trip specifically, separate from the package it may have
            started from. If a package was picked when the trip was created, its
            days are copied in as a starting point; otherwise it starts empty.
          </p>
          <Bullets
            items={[
              <>
                Add or edit a day the same way as on a package: title,
                description, a hotel picked from suppliers, a note, and meals.
              </>,
              <>
                Editing a trip&apos;s days never changes the original package —
                the day the actual hotel differs from the template is exactly why
                this exists.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>The two buttons at the top</SubHeading>
          <Fields
            rows={[
              {
                name: "Record payment",
                note: "Takes a receipt against this trip. This is the only place receipts are entered — see Payments.",
              },
              {
                name: "Print invoice",
                note: "Opens a printable invoice built from the trip's stored totals and its receipts. Use the browser's Save as PDF to send it. There is no invoice register to keep in sync — the trip code is the reference.",
              },
            ]}
          />
        </div>
      </Section>

      {/* ----------------------------------------------------------- costing */}
      <Section {...section("costing")}>
        <p className="text-muted-foreground">
          Three tabs on the trip page — <strong>Costs</strong>,{" "}
          <strong>Vehicles</strong> and <strong>Breakdown</strong>. This is where
          a trip stops being a price and becomes a margin.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>Cost lines</SubHeading>
          <p className="text-muted-foreground">
            Add what the trip costs you, one line at a time — a hotel, a
            transporter, a guide, permits.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COST_CATEGORIES.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
          </div>
          <Fields
            rows={[
              { name: "Category", note: "One of the list above. The by-category breakdown reads this." },
              {
                name: "Supplier",
                note: "Optional but worth setting — it is what makes spend-by-supplier possible, and what a supplier's outstanding is worked out from.",
              },
              { name: "Vehicle", note: "For transport lines, ties the cost to a vehicle for the running-cost report." },
              { name: "Description", note: "Optional — a line with no description just shows its category instead." },
              { name: "Service date", note: "The night or the day this covers." },
              {
                name: "Quantity, Unit cost",
                note: "Multiplied together to give the line's cost — the quantity label changes with the category (Nights for a hotel, Days for transport, Pax for activities, Tickets for flights…). Fuel, tolls and misc are inherently one line, so there is no quantity field at all — just an amount.",
              },
              {
                name: "Sell amount",
                note: "What this element is being sold to the customer for — an excursion charged on top of the package price, say. It counts into the trip's revenue and profit on the Breakdown tab; it does not add to the trip's own \"grand total\" figure, so collect it as a separate receipt if it isn't already folded into the trip price.",
              },
              {
                name: "Status",
                note: "Planned, Booked or Cancelled. Cancelled lines are excluded from cost and profit entirely.",
              },
              { name: "Confirmation no.", note: "The hotel or transporter's reference." },
            ]}
          />
          <Bullets
            items={[
              <>
                Pick a <strong>supplier</strong> with a rate card and its rates
                appear as quick-pick buttons — one click fills in the description
                and unit cost from what you already charged them last time.
              </>,
              <>
                For a <strong>Hotel</strong> line, the hotels already chosen on
                this trip&apos;s Itinerary tab show up the same way, so the cost
                line and the day plan never quietly name two different hotels.
              </>,
              <>
                Pick a <strong>Transport</strong> line&apos;s vehicle and the days
                and rate fill in from that vehicle&apos;s assignment and its
                standing per-day rate — check the numbers rather than typing them
                from scratch.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Vehicles</SubHeading>
          <Bullets
            items={[
              <>
                Assign a <strong>vehicle and driver</strong> for a date range,
                with an opening odometer reading. A <strong>transport cost</strong>
                {" "}line for it is offered at the same time — pre-filled from the
                vehicle&apos;s own per-day rate and the dates you just entered —
                so assigning the vehicle and costing it is one step, not two.
              </>,
              <>
                The same vehicle <strong>cannot be assigned to overlapping
                dates</strong>. The refusal is a scheduling answer, not an error —
                that vehicle is already out.
              </>,
              <>
                Log the <strong>closing odometer reading</strong> from this tab
                once the vehicle is back — the gauge button next to each
                assignment. That reading is what lets a <strong>Fuel</strong> cost
                line estimate its own cost, from distance driven ÷ the
                vehicle&apos;s mileage × its fuel price.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Breakdown</SubHeading>
          <p className="text-muted-foreground">
            The whole trip in one panel: revenue, supplier cost, direct expenses,
            total cost, profit and margin, plus received, advance and balance, and
            what is still owed to suppliers. Cost is also split by category.
          </p>
        </div>
      </Section>

      {/* --------------------------------------------------------- suppliers */}
      <Section {...section("suppliers")}>
        <p className="text-muted-foreground">
          Everyone you buy from — hotels, homestays, resorts, transporters,
          guides, activity operators, restaurants, airlines and agents.
        </p>

        <Fields
          rows={[
            { name: "Name, Type", note: "Name is required; type is one of the list above and is a filter on the list." },
            { name: "Contact person, Phone, Alternate phone, Email", note: "Who you actually call." },
            { name: "Address, City, State", note: "Optional." },
            { name: "GSTIN", note: "For their bills." },
            { name: "Payment terms", note: "Free text — \"50% advance, balance on checkout\". Written down so it is not remembered wrongly." },
            { name: "Bank details", note: "Where you transfer money. Free text." },
            { name: "Rating", note: "1 to 5, your own view of them." },
            { name: "Active", note: "Untick to retire a supplier you have stopped using — they stay on old trips but drop out of the pickers." },
          ]}
        />

        <div className="flex flex-col gap-3">
          <SubHeading>Rate cards</SubHeading>
          <p className="text-muted-foreground">
            Per supplier, a list of what they charge: a title, a unit (
            &quot;per room per night&quot;, &quot;per day&quot;), the rate, and
            optional valid-from and valid-to dates. Keeping these current is what
            stops trip costing from relying on memory.
          </p>
        </div>

        <Note>
          A supplier used on a trip cost line cannot be deleted — that would break
          the trip&apos;s history. Untick <strong>Active</strong> instead.
        </Note>
      </Section>

      {/* ------------------------------------------------------------- fleet */}
      <Section {...section("fleet")}>
        <p className="text-muted-foreground">
          Two tabs: <strong>Vehicles</strong> and <strong>Drivers</strong>. Both
          owned and regularly hired vehicles belong here.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>Vehicle fields</SubHeading>
          <Fields
            rows={[
              {
                name: "Registration number",
                note: "Required. Saved in capitals with spaces removed, so KL 07 AB 1234 and kl07ab1234 are the same vehicle.",
              },
              { name: "Type", note: "Hatchback, Sedan, SUV, Tempo Traveller, Mini Bus, Bus, Bike or Other." },
              { name: "Make, Model", note: "Optional." },
              { name: "Seating capacity", note: "1 to 80. Check this against the party size before assigning." },
              {
                name: "Ownership",
                note: "Owned or Hired. A hired vehicle can be linked to the supplier you hire it from.",
              },
              { name: "Default driver", note: "Who usually drives it — pre-filled when you assign." },
              {
                name: "Rate per km / per day",
                note: "What it costs to run — the per-day rate pre-fills a transport cost line the moment you assign this vehicle to a trip.",
              },
              {
                name: "Mileage (km/l), Fuel price per litre",
                note: "Set both and a Fuel cost line for this vehicle can estimate its own cost from distance driven, once the trip records a closing odometer reading.",
              },
              {
                name: "Insurance, Fitness, PUC expiry",
                note: "The papers. Fill these in and the system can warn you before one lapses.",
              },
              { name: "Active", note: "Untick for a vehicle out of service or no longer hired." },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Driver fields</SubHeading>
          <Fields
            rows={[
              { name: "Name, Phone", note: "Both required." },
              { name: "Licence number, Licence expiry", note: "Worth keeping current for permits and checks." },
              { name: "Address", note: "Optional." },
              { name: "Daily allowance", note: "What the driver is paid per day, for costing driver allowance on a trip." },
              { name: "Active", note: "Untick for someone who has left." },
            ]}
          />
        </div>

        <Note>
          An assigned vehicle cannot be deleted, and no vehicle can be in two
          places at once — an overlapping date range is refused outright.
        </Note>
      </Section>

      {/* ---------------------------------------------------------- payments */}
      <Section {...section("payments")}>
        <p className="text-muted-foreground">
          Money received from customers. Two tabs:{" "}
          <strong>Outstanding</strong> — every trip still carrying a balance,
          which is the chase list — and <strong>Receipts</strong>, the log of what
          has come in.
        </p>

        <Note>
          Receipts are <strong>recorded from the trip page</strong>, using{" "}
          <em>Record payment</em> — not from this screen. This screen is where you
          read them back, filter them, and void a mistake.
        </Note>

        <div className="flex flex-col gap-3">
          <SubHeading>Recording a receipt</SubHeading>
          <Fields
            rows={[
              {
                name: "Amount received",
                note: "Must be more than zero, and cannot exceed the balance still due on that trip — an over-payment is refused with the actual balance in the message.",
              },
              { name: "Mode", note: "Cash, UPI, Bank transfer, Card, Cheque or Other." },
              { name: "Received on", note: "The date the money actually arrived, not the date you typed it in." },
              { name: "Reference", note: "UPI reference, cheque number, transaction id — whatever you would quote if it were queried." },
              {
                name: "This is the advance",
                note: "Ticked automatically for the first payment on a trip. It is what the advance figure on the breakdown counts.",
              },
              { name: "Notes", note: "Anything else." },
            ]}
          />
          <p className="text-muted-foreground">
            Each receipt gets a number of its own, e.g.{" "}
            <strong>RCP/26-27/0001</strong>, restarting each financial year.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Fixing a mistake</SubHeading>
          <p className="text-muted-foreground">
            A receipt is never edited. <strong>Void</strong> it with a reason: the
            entry stays visible, and it stops counting towards received and
            balance everywhere in the system. Then record the correct one. That is
            what keeps the ledger readable as a history rather than a final state.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------- expenses */}
      <Section {...section("expenses")}>
        <p className="text-muted-foreground">
          Everything spent that is not a supplier bill on a cost line — fuel,
          tolls, office rent, salaries, marketing. Each gets a number like{" "}
          <strong>EXP/26-27/0001</strong>.
        </p>

        <Fields
          rows={[
            { name: "Description", note: "Required — what the money went on." },
            { name: "Amount", note: "Required, more than zero." },
            { name: "Spent on", note: "The date. This is what the date-range filters and reports work from." },
            { name: "Mode", note: "How it was paid — cash, UPI, bank transfer, card, cheque or other." },
            { name: "Category", note: "Chosen from your category list. Categories are marked trip-related or not, which is what decides whether the spend is a trip cost or an overhead." },
            {
              name: "Trip",
              note: "Tag it to a trip and it counts into that trip's cost and profit. Leave it empty for general overheads.",
            },
            { name: "Vehicle", note: "Tag it to a vehicle and it appears in the running-cost-by-vehicle report." },
            { name: "Bill", note: "Upload the bill or receipt image so the paper does not have to be found later." },
          ]}
        />

        <Note>
          <strong>Approving an expense locks it.</strong> Once approved it can no
          longer be edited or deleted, so approve at the end of a review rather
          than as you go. Operations staff can log expenses; approving is a
          Manager, Accounts or Admin job.
        </Note>
      </Section>

      {/* ----------------------------------------------------------- reports */}
      <Section {...section("reports")}>
        <p className="text-muted-foreground">
          What the business actually made, over a date range you pick. Restricted
          — Sales and Operations staff cannot open this screen at all.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>At the top</SubHeading>
          <p className="text-muted-foreground">
            Profit and loss for the range: revenue, cost, expenses and profit,
            with the month-on-month trend. Everything below re-cuts the same
            period.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>The five tabs</SubHeading>
          <Fields
            rows={[
              { name: "By trip", note: "Revenue, cost and profit for every trip in the range. The place to find the trip that lost money." },
              { name: "By category", note: "Where the money went, by expense and cost category." },
              { name: "Suppliers", note: "Total spend per supplier — useful before you negotiate next season's rates." },
              { name: "Vehicles", note: "Running cost per vehicle, from fuel, tolls and repairs tagged to it." },
              { name: "Staff", note: "Enquiries, conversions and booked value per consultant." },
            ]}
          />
        </div>
      </Section>

      {/* -------------------------------------------------------------- team */}
      <Section {...section("team")}>
        <p className="text-muted-foreground">
          Your own staff, as opposed to your customers. Two screens —{" "}
          <strong>Employees</strong> and <strong>Attendance</strong>.
        </p>

        <Note>
          <strong>Attendance is currently hidden from the sidebar</strong> along
          with Payroll, below. Nothing about either screen has changed — they
          just are not linked from the menu for now.
        </Note>

        <div className="flex flex-col gap-3">
          <SubHeading>Employee records</SubHeading>
          <p className="text-muted-foreground">
            Each employee gets a code automatically, e.g.{" "}
            <strong>EMP-0012</strong>.
          </p>
          <Fields
            rows={[
              { name: "Name, Phone", note: "Both required." },
              { name: "Email", note: "Optional." },
              { name: "Designation, Department", note: "Free text — what they do and which team they are in. Department filters the list." },
              { name: "Date of joining, Date of birth", note: "Optional." },
              {
                name: "Per day salary",
                note: "What this person is paid for one day worked. Payroll works from this directly, so an employee without it is left out of the salary run.",
              },
              {
                name: "Paid leaves per month",
                note: "How many leave days this employee can take a month before it costs them. Defaults to 2, and can be set per employee.",
              },
              { name: "Emergency contact", note: "Free text." },
              {
                name: "Login account",
                note: "Links this person to their user account, so attendance and leave line up with who they are in the system.",
              },
              { name: "Status", note: "Active, On leave, Resigned or Terminated. Only active employees appear on the daily register." },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>The daily register</SubHeading>
          <Bullets
            items={[
              <>
                Attendance is marked <strong>a whole day at a time</strong>. The
                register is a grid of every active employee, not a list of what
                already exists, so nobody gets missed.
              </>,
              <>
                Per person: Present, Absent, Half day, Leave, Holiday or Week off,
                plus check-in and check-out times.
              </>,
              <>
                Re-marking a day <strong>updates</strong> that entry rather than
                adding a second one — so correcting yesterday is safe.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Leave</SubHeading>
          <p className="text-muted-foreground">
            Leave runs the way it already runs in the office: the employee asks
            their manager, and the manager enters it. Staff do not have a screen
            of their own, and nothing is waiting on them.
          </p>
          <Steps
            items={[
              <>
                On the <strong>Leave</strong> tab of Attendance, a Manager or
                Admin presses <strong>Record leave</strong>: employee, type —
                casual, sick, paid, unpaid or comp-off — the dates, and the
                reason. The number of days is worked out from the dates.
              </>,
              <>
                It is saved <strong>pending</strong>. An <strong>Admin</strong> or{" "}
                <strong>Super Admin</strong> approves or rejects it, optionally
                with a note. A Manager can record leave but not decide it.
              </>,
              <>
                Mark the days themselves as <strong>Leave</strong> on the daily
                register. Recording a request does not fill in the register for
                you.
              </>,
            ]}
          />
          <Note>
            The Leave tab shows every request with its status, not just the
            pending ones — so the manager who recorded it can see what was
            decided. The Approve and Reject buttons only appear for someone who
            holds the permission.
          </Note>
        </div>
      </Section>

      {/* ----------------------------------------------------------- payroll */}
      <Section {...section("payroll")}>
        <p className="text-muted-foreground">
          Salaries for a month, worked out from the attendance register and posted
          into Expenses. Nothing is typed twice: the register you already mark
          every day is the input.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>How a month is worked out</SubHeading>
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
            <p>Day rate = set directly on the employee record</p>
            <p>Unpaid days = absences + leave beyond their monthly allowance + ½ per half-day</p>
            <p>Deduction = Unpaid days × Day rate</p>
            <p>Gross salary = Day rate × days in the month</p>
            <p>Net pay = Gross salary − Deduction</p>
          </div>
          <Bullets
            items={[
              <>
                Every employee has their own{" "}
                <strong>paid leaves per month</strong> allowance, defaulting to{" "}
                <strong>two</strong>. Leave beyond that allowance is deducted.
              </>,
              <>
                <strong>Present, holiday and week-off are paid</strong> in full,
                and so are days nobody marked — the register being incomplete
                never costs an employee money. Unmarked days are counted and shown
                on screen, so you can tell the difference between a quiet month and
                an unmarked one.
              </>,
              <>
                <strong>Absences and a half-day</strong> are the only other things
                that reduce pay. A half-day costs half a day&apos;s rate.
              </>,
              <>
                Gross salary is the day rate × <strong>calendar days</strong> in
                the month, so a month with nothing marked against an employee
                pays exactly that figure.
              </>,
              <>
                An employee with <strong>no day rate on record</strong> is left
                out and named in a warning at the top — they are never quietly
                paid zero.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Posting a month</SubHeading>
          <Steps
            items={[
              <>
                Pick the <strong>month</strong>. Check the four tiles — employees,
                gross, deductions, net payable — and read down the Unpaid days
                column for anything that looks wrong.
              </>,
              <>
                Fix the register first if it is wrong. Attendance is the input, and
                correcting it changes these figures immediately.
              </>,
              <>
                Press <strong>Post to expenses</strong>. This writes{" "}
                <strong>one expense per employee</strong> under the Salaries
                category, for their net pay, dated the last day of that month — so
                the spend lands in the month it was earned.
              </>,
            ]}
          />
          <Note>
            A month can be posted <strong>once</strong>, and there is no undo.
            After posting, Payroll shows the figures as history rather than
            recalculating them, so a later attendance correction cannot silently
            rewrite pay that has already gone out. A genuine mistake is corrected
            on the Expenses screen like any other entry.
          </Note>
          <p className="text-muted-foreground">
            A <strong>Manager</strong> can open Payroll and check a month but
            cannot post it. Posting is <strong>Admin</strong> and{" "}
            <strong>Super Admin</strong> only. If the figures change between
            loading the page and posting — someone edits the register in another
            tab — the post is refused and you are asked to look again, rather than
            paying a total nobody approved.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>What it does not do</SubHeading>
          <p className="text-muted-foreground">
            There are no allowances, bonuses, advances or statutory deductions —
            no PF, ESI or TDS — and no payslip to hand an employee. Pay is gross
            salary less unpaid days, and nothing else.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------ system */}
      <Section {...section("system")}>
        <p className="text-muted-foreground">
          Access and configuration. Mostly Super Admin territory.
        </p>

        <div className="flex flex-col gap-3">
          <SubHeading>Users</SubHeading>
          <Fields
            rows={[
              {
                name: "Username",
                note: "3 to 40 characters, lowercase letters, numbers, dots, hyphens and underscores only. This is what they sign in with, and it cannot be changed later.",
              },
              {
                name: "Password",
                note: "At least 8 characters including a letter and a number. Deliberately modest — long arbitrary rules push staff towards sticky notes.",
              },
              { name: "Name, Email, Phone", note: "Optional. The name is what appears at the bottom of their sidebar." },
              {
                name: "Role",
                note: "Decides everything they can see and do. See Who can see what below.",
              },
              {
                name: "Active",
                note: "Untick to lock someone out. They are signed out and told the account was deactivated.",
              },
            ]}
          />
          <Bullets
            items={[
              <>
                <strong>Resetting a password</strong> is its own action, never a
                side effect of editing the account.
              </>,
              <>
                <strong>Deactivate rather than delete</strong> someone who leaves,
                so their past work stays attributed to them.
              </>,
              <>
                Only <strong>Super Admin</strong> can create or change user
                accounts — an Admin can do everything else but not this.
              </>,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SubHeading>Settings</SubHeading>
          <Note>
            The Settings screen is a placeholder — there is nothing to fill in
            there yet. The business name, address, phone and GSTIN printed on an
            invoice currently come from a constant in the code, so changing them
            is a developer job, not a screen. The GST rate is set per trip, not
            globally.
          </Note>
        </div>
      </Section>

      {/* ------------------------------------------------------------- money */}
      <Section {...section("money")}>
        <p className="text-muted-foreground">
          Several amounts look similar and are easy to mix up. This is the whole
          set, in one place.
        </p>

        <Fields
          rows={[
            { name: "Budget", note: "On an enquiry: what the customer said they want to spend. Nothing is calculated from it." },
            { name: "Price per adult / child", note: "On a trip priced per head: multiplied by the party size to give the subtotal. Infants are never priced." },
            { name: "Package price", note: "On a trip priced fixed: the subtotal, entered directly." },
            { name: "Discount", note: "On a trip: taken off the subtotal before GST. Never more than the subtotal." },
            { name: "GST %", note: "On a trip: applied to the amount after discount. Stored with the trip, so a later rate change does not rewrite old trips." },
            { name: "Grand total", note: "On a trip: what the customer owes on the trip itself." },
            { name: "Unit cost × Quantity", note: "On a cost line: what that element costs you." },
            { name: "Sell amount", note: "On a cost line: what that element is sold for on top of the package. Added into the trip's revenue and profit on the Breakdown tab — it is not part of the trip's own grand total." },
            { name: "Cancellation charge", note: "On a cancelled trip: the non-refundable amount you kept. This becomes the trip's revenue for balance and profit purposes once it's cancelled — not the original grand total." },
            { name: "Day rate", note: "On an employee: what they're paid for one day worked, entered directly. Payroll multiplies it by days in the month to get the gross salary." },
            { name: "Paid leaves per month", note: "On an employee: how many leave days they can take a month before it costs them. Defaults to 2." },
            { name: "Deduction", note: "On a payroll line: unpaid days × day rate. Absences, leave beyond that employee's monthly allowance, and half a day per half-day." },
            { name: "Net pay", note: "On a payroll line: gross salary (day rate × days in the month) less the deduction. This is the amount posted to Expenses." },
            { name: "Advance", note: "The first receipt on a trip. Counts towards received like any other." },
            { name: "Received", note: "The sum of receipts that have not been voided." },
            { name: "Balance", note: "Grand total minus received — what is still to collect." },
          ]}
        />

        <div className="flex flex-col gap-3">
          <SubHeading>How the numbers are worked out</SubHeading>
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
            <p>Subtotal = (price per adult × adults) + (price per child × children)</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= package price, when priced fixed</p>
            <p>Taxable = Subtotal − Discount</p>
            <p>GST = Taxable × GST rate</p>
            <p>Grand total = Taxable + GST</p>
            <p>Revenue = Grand total + sell amounts from cost lines</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= Cancellation charge instead, once the trip is cancelled</p>
            <p>Trip cost = cost lines not cancelled + expenses tagged to the trip</p>
            <p>Profit = Revenue − Trip cost</p>
            <p>Margin = Profit ÷ Revenue × 100</p>
            <p>Received = receipts not voided</p>
            <p>Balance = Revenue − Received</p>
            <p>Owed to supplier = its cost lines − payments made to it</p>
          </div>
          <Note>
            Three things account for most &quot;this number looks wrong&quot;
            questions. <strong>Cancelled cost lines are excluded entirely</strong>{" "}
            from cost and profit — not counted as zero.{" "}
            <strong>Voided receipts stop counting</strong> towards received and
            balance the moment they are voided. And a cost line&apos;s{" "}
            <strong>sell amount adds to revenue</strong>, so profit on a trip with
            priced add-ons is higher than the grand total alone would suggest.
          </Note>
        </div>
      </Section>

      {/* ------------------------------------------------------------- roles */}
      <Section {...section("roles")}>
        <p className="text-muted-foreground">
          A user&apos;s role decides which modules appear in their sidebar and
          what they can do inside them. Menu items they cannot use are hidden
          rather than greyed out.
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Role</TableHead>
                <TableHead>What they get</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map((role) => (
                <TableRow key={role.name}>
                  <TableCell className="align-top font-medium whitespace-nowrap">
                    {role.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.sees}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-muted-foreground">
          One split worth knowing: a <strong>Manager</strong> records leave but
          cannot decide it. Approving and rejecting is <strong>Admin</strong> and{" "}
          <strong>Super Admin</strong> only.
        </p>

        <Note>
          Hiding a menu item is presentation only — every page and every action
          checks the same permission on the server as well. A role that cannot
          open Reports cannot reach them by any other route either.
        </Note>

        <div className="flex flex-col gap-3">
          <SubHeading>Full permission matrix</SubHeading>
          <p className="text-muted-foreground">
            Every action in the system, and exactly which roles can do it. This
            table is generated from the same permission list the server checks
            on every request, so it can never fall out of date with what a role
            actually gets.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-44">Action</TableHead>
                  {ROLE_ORDER.map((role) => (
                    <TableHead key={role} className="text-center whitespace-nowrap">
                      {ROLE_LABELS[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSION_GROUPS.map((group) => (
                  <Fragment key={group.resource}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell
                        colSpan={ROLE_ORDER.length + 1}
                        className="py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                      >
                        {group.resource}
                      </TableCell>
                    </TableRow>
                    {group.permissions.map((permission) => (
                      <TableRow key={permission}>
                        <TableCell className="whitespace-nowrap">
                          {humanize(permission.split(":")[1])}
                        </TableCell>
                        {ROLE_ORDER.map((role) => (
                          <TableCell key={role} className="text-center">
                            {ROLE_PERMISSIONS[role].includes(permission) ? (
                              <CheckIcon className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------- not-yet */}
      <Section {...section("not-yet")}>
        <p className="text-muted-foreground">
          A few things the system records or supports underneath but has no screen
          for yet. Listed here so nobody spends twenty minutes hunting for a
          button that does not exist.
        </p>
        <Fields
          rows={[
            {
              name: "Supplier payments",
              note: "What you have paid a supplier is stored, and a trip's breakdown shows what is still owed to them — but there is no screen yet for entering a payment out.",
            },
            {
              name: "Passenger list",
              note: "A trip holds a passenger manifest with names, ages and ID details, but there is no screen yet to enter it.",
            },
            {
              name: "Self-service leave",
              note: "Staff cannot raise their own request — they ask their manager, who records it on the Leave tab. There is no employee-facing leave screen.",
            },
            {
              name: "Audit trail viewer",
              note: "Every create, edit, cancellation and approval is recorded with who and when, but there is no screen yet to browse it.",
            },
            {
              name: "Settings",
              note: "The screen exists but is empty. Letterhead details live in the code for now.",
            },
          ]}
        />
      </Section>

      {/* --------------------------------------------------------------- faq */}
      <Section {...section("faq")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <SubHeading>&quot;Balance due on this trip is only ₹…&quot;</SubHeading>
            <p className="text-muted-foreground">
              You are trying to receive more than the trip still owes. Check the
              amount — and if the trip total is genuinely wrong, fix the trip
              first, then take the receipt.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>&quot;A cancelled booking cannot be edited&quot;</SubHeading>
            <p className="text-muted-foreground">
              Cancelling closes a trip for good. If the customer has rebooked,
              create a new trip rather than reopening the cancelled one.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>It won&apos;t let me delete something</SubHeading>
            <p className="text-muted-foreground">
              Records in use are protected: a customer with a trip, a supplier on
              a cost line, an assigned vehicle, a trip with money received, an
              approved expense. Deactivate, retire or cancel instead — the message
              says which applies.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>I deleted something by mistake — is it gone?</SubHeading>
            <p className="text-muted-foreground">
              Usually there was nothing to lose, because anything with history
              attached refuses to delete. What can be deleted is archived rather
              than erased, and a wrong receipt is voided rather than removed — it
              is still there, marked void.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>&quot;Please record why this lead was lost&quot;</SubHeading>
            <p className="text-muted-foreground">
              Marking an enquiry Lost needs a reason. It is one line, and it is the
              only way the pipeline tells you anything useful later.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>It won&apos;t assign the vehicle</SubHeading>
            <p className="text-muted-foreground">
              That vehicle is already assigned across dates that overlap the ones
              you asked for. Pick another vehicle, or check the other trip&apos;s
              dates.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>An enquiry I was working on has disappeared</SubHeading>
            <p className="text-muted-foreground">
              Sales consultants see only their own enquiries, so it was probably
              reassigned. Ask a manager, who can see the whole pipeline.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>The customer says the itinerary link is dead</SubHeading>
            <p className="text-muted-foreground">
              Either sharing was switched off for that itinerary, or the link was
              regenerated — which is exactly how you invalidate a quote you do not
              want circulating. Copy the current link and resend it.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>Where do I raise an invoice?</SubHeading>
            <p className="text-muted-foreground">
              You don&apos;t. Open the trip and press <strong>Print invoice</strong>
              , then use the browser&apos;s Save as PDF. It is built from the
              trip&apos;s stored totals and receipts, so it is always current.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>The customer paid before the trip was finalised</SubHeading>
            <p className="text-muted-foreground">
              Record the advance against the trip anyway. It counts towards the
              balance immediately and appears on the invoice whenever it is
              printed.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>Two of us added the same customer</SubHeading>
            <p className="text-muted-foreground">
              You didn&apos;t — the second attempt was refused, because phone
              numbers are unique. Search by number before adding anyone.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <SubHeading>My colleague can see Reports and I can&apos;t</SubHeading>
            <p className="text-muted-foreground">
              The financial reports are limited to Accounts, Managers and above. If
              you genuinely need them, ask for your role to be changed rather than
              borrowing a login.
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
