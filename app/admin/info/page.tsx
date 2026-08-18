import Link from "next/link"
import {
  BanknoteIcon,
  BriefcaseIcon,
  BusIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  MapIcon,
  PlayCircleIcon,
  ReceiptIcon,
  Settings2Icon,
  ShieldIcon,
  Store,
  UserRoundCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"

/**
 * Written reference for the whole admin panel.
 *
 * Deliberately plain server-rendered content — no data fetching, no client
 * state. Staff open this when they are stuck mid-task, so it is organised the
 * way the sidebar is, and each module answers the same three questions: what it
 * holds, what you do in it, and what it feeds next.
 */

// Replace with the actual guide video URL once one is recorded.
const video = {
  title: "How to use the admin panel",
  description: "A walkthrough of the same ground this page covers, end to end.",
  url: "#",
  duration: "10 min",
}

interface Module {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** One line: what this module is for. */
  purpose: string
  /** The everyday jobs done here. */
  does: string[]
  /** How it connects to the rest of the system. */
  feeds?: string
}

interface Group {
  label: string
  blurb: string
  modules: Module[]
}

const GROUPS: Group[] = [
  {
    label: "Overview",
    blurb: "Where the day starts.",
    modules: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboardIcon,
        purpose:
          "The morning summary — what is booked, what is owed, and what needs chasing today.",
        does: [
          "Shows enquiry, trip and revenue counts for the current period",
          "Surfaces today's and overdue follow-ups so nothing goes cold",
          "Highlights outstanding balances across active trips",
        ],
        feeds: "Read-only. Every number here is produced by the modules below.",
      },
    ],
  },
  {
    label: "Sales",
    blurb:
      "Everything from the first phone call to an accepted quote. Work left to right: Leads → Follow-ups → Packages, with Customers as the shared address book.",
    modules: [
      {
        title: "Leads",
        href: "/admin/leads",
        icon: BriefcaseIcon,
        purpose:
          "The enquiry pipeline. One record per person who has asked about a trip.",
        does: [
          "Capture an enquiry in one form — the customer record is created or matched by phone number automatically, so nobody has to add a customer first",
          "Track the stage: New → Contacted → Quoted → Negotiating → Won or Lost",
          "Set priority and assign an owner; marking a lead Lost requires a reason, so the pipeline stays honest",
          "Every stage change is logged on the lead's activity trail",
        ],
        feeds:
          "Converting an enquiry into a trip marks it Won automatically. Sales staff see only their own enquiries; managers see everything.",
      },
      {
        title: "Follow-ups",
        href: "/admin/followups",
        icon: CalendarCheckIcon,
        purpose:
          "The call-back queue. A dated reminder attached to a lead, so enquiries do not go quiet.",
        does: [
          "Filter by Overdue, Today, This week or Upcoming",
          "Schedule a follow-up by channel — call, WhatsApp, email or visit",
          "Log the outcome when done, and chain the next follow-up in the same step",
          "Move the lead's stage at the same time as recording the outcome",
        ],
        feeds: "Drives the follow-up counts shown on the Dashboard.",
      },
      {
        title: "Customers",
        href: "/admin/customers",
        icon: UsersIcon,
        purpose:
          "The address book. One record per traveller or family, reused across every trip they take.",
        does: [
          "Store contact details, address, GSTIN and how they found you",
          "Phone numbers are unique — the system refuses a duplicate rather than splitting one customer's history in two",
          "See a customer's trips and payment history in one place",
        ],
        feeds:
          "A customer with a trip cannot be deleted. Referenced by Enquiries and Trips.",
      },
      {
        title: "Packages",
        href: "/admin/packages",
        icon: MapIcon,
        purpose:
          "Itineraries — both reusable packages and one-off customer quotes.",
        does: [
          "Build a day-by-day plan with descriptions, stay notes, meals and photos",
          "Set pricing per-head or as a fixed package price, with inclusions and exclusions",
          "Publish, then share a read-only public link the customer can open without logging in",
          "Clone a package into a custom quote for a specific enquiry instead of retyping it",
        ],
        feeds:
          "An accepted quote becomes a Trip. Sharing can be switched off, and the link can be regenerated to invalidate the old one.",
      },
    ],
  },
  {
    label: "Operations",
    blurb:
      "Delivering the trip that was sold — the money going out, and the vehicles going with it.",
    modules: [
      {
        title: "Trips",
        href: "/admin/trips",
        icon: CalendarCheckIcon,
        purpose:
          "A confirmed trip. The centre of the system — costing, vehicles and payments all hang off it.",
        does: [
          "Converted from an enquiry in one click, or created directly from a phone call",
          "Prices per head or as a fixed amount; discount is applied before GST, and the totals are stored so nothing recalculates behind your back",
          "Track status: Confirmed → In progress → Completed",
          "Record the passenger list, and add trip costs line by line — hotel, transport, guide, permits and so on, each optionally tied to a supplier",
          "The ledger tab shows revenue, cost, profit, received and balance for that trip; cancelled cost lines are excluded from profit",
        ],
        feeds:
          "Cancelling needs a reason and can carry a cancellation charge. A trip with money received cannot be deleted — cancel it instead.",
      },
      {
        title: "Suppliers",
        href: "/admin/suppliers",
        icon: Store,
        purpose:
          "Everyone you buy from — hotels, homestays, transporters, guides, restaurants and agents.",
        does: [
          "Keep contact, payment terms, bank details, GSTIN and a rating",
          "Maintain a rate card per supplier so trip costing does not rely on memory",
          "Mark a supplier inactive instead of deleting when you stop using them",
        ],
        feeds:
          "Attached to trip cost lines and supplier payments. A supplier used on a cost line cannot be deleted.",
      },
      {
        title: "Fleet",
        href: "/admin/fleet",
        icon: BusIcon,
        purpose: "Vehicles and drivers, owned or regularly hired.",
        does: [
          "Register vehicles with type, seating, ownership and per-km or per-day rates",
          "Track insurance, fitness and PUC expiry dates",
          "Keep driver records with licence details and daily allowance",
          "Assign a vehicle and driver to a trip for a date range",
        ],
        feeds:
          "The same vehicle cannot be assigned to overlapping dates — the system refuses the clash. An assigned vehicle cannot be deleted.",
      },
    ],
  },
  {
    label: "Accounts",
    blurb:
      "Money in, money out, and what it all added up to. Entries here are reversed rather than edited, so the ledger stays auditable.",
    modules: [
      {
        title: "Payments",
        href: "/admin/payments",
        icon: WalletIcon,
        purpose:
          "Money received from customers, and money paid out to suppliers.",
        does: [
          "Record receipts by mode — cash, UPI, bank transfer, card or cheque — with a reference",
          "Advances taken before the invoice exists are counted against it once raised",
          "The Outstanding tab lists every trip with a balance still due",
          "A receipt above the outstanding balance is refused",
        ],
        feeds:
          "Voiding a receipt reverses its allocation rather than editing it. Supplier payments cannot be voided at all — record a reversing payment instead.",
      },
      {
        title: "Expenses",
        href: "/admin/expenses",
        icon: ReceiptIcon,
        purpose:
          "Everything spent that is not a supplier bill — fuel, tolls, office rent, salaries, marketing.",
        does: [
          "Log an expense against a category, and optionally against a trip or vehicle",
          "Trip-related categories feed that trip's cost; the rest are overheads",
          "Approve an expense to lock it — once approved it can no longer be edited or deleted",
        ],
        feeds: "Rolls into the expense and vehicle-cost reports.",
      },
      {
        title: "Reports",
        href: "/admin/reports",
        icon: ChartNoAxesCombinedIcon,
        purpose: "What the business actually made, over a date range you pick.",
        does: [
          "Profit and loss, and revenue by trip",
          "Expenses by category, spend by supplier, and cost by vehicle",
          "Staff performance, and the month-on-month trend",
        ],
        feeds:
          "Financial reports are restricted — Sales and Operations staff cannot open them.",
      },
    ],
  },
  {
    label: "Team",
    blurb: "Your own staff, as opposed to your customers.",
    modules: [
      {
        title: "Employees",
        href: "/admin/employees",
        icon: UserRoundCheckIcon,
        purpose:
          "Staff records — designation, department, joining date and salary.",
        does: [
          "Each employee gets a code automatically",
          "Optionally link an employee to their login account",
          "Track status: Active, On leave, Resigned or Terminated",
          "Raise and decide leave requests, by type — casual, sick, paid, unpaid or comp-off",
        ],
      },
      {
        title: "Attendance",
        href: "/admin/attendance",
        icon: BanknoteIcon,
        purpose: "The daily register.",
        does: [
          "Mark a whole day at once — the register is a grid of every active employee, not a list of what already exists",
          "Record status and check-in/check-out times",
          "Re-marking a day updates that entry rather than adding a second one",
          "Review approved leave alongside the register",
        ],
      },
    ],
  },
  {
    label: "System",
    blurb: "Access and configuration. Mostly Super Admin territory.",
    modules: [
      {
        title: "Users",
        href: "/admin/users",
        icon: ShieldIcon,
        purpose: "Login accounts and what each one is allowed to do.",
        does: [
          "Create accounts with a role, which decides everything they can see",
          "Reset a password — it is changed through its own action, never as a side effect of editing the account",
          "Deactivate an account rather than deleting it, so their past work stays attributed",
        ],
        feeds: "Only Super Admin can manage users.",
      },
      {
        title: "Settings",
        href: "/admin/settings",
        icon: Settings2Icon,
        purpose: "Company details and defaults used across documents.",
        does: [
          "Business name, address and GSTIN as they appear on invoices",
          "Default GST rate and invoice terms",
        ],
      },
    ],
  },
]

const ROLES: { name: string; sees: string }[] = [
  {
    name: "Super Admin",
    sees: "Everything, including user management and the audit trail.",
  },
  {
    name: "Admin",
    sees: "Everything operational. Cannot manage user accounts.",
  },
  {
    name: "Manager",
    sees:
      "All of Sales, Operations and Accounts, plus the team modules. Can assign enquiries, cancel trips and publish itineraries.",
  },
  {
    name: "Accounts",
    sees:
      "Invoices, payments, expenses and financial reports. Read-only on trips and suppliers.",
  },
  {
    name: "Sales",
    sees:
      "Enquiries, customers, itineraries and trips — scoped to their own enquiries. No money screens.",
  },
  {
    name: "Operations",
    sees:
      "All trips, suppliers, fleet and trip costing. Can log expenses, but not approve them or see financial reports.",
  },
  { name: "Staff", sees: "Read-only on customers and leads." },
]

const FLOW = [
  "An enquiry comes in and is logged in Leads — the customer record is created or matched by phone at the same time.",
  "Follow-ups keep it moving until the customer decides.",
  "A quote is built in Packages, shared as a link, and accepted.",
  "It becomes a Trip. Trip costs and a vehicle are added.",
  "Payments are recorded against the trip; Print invoice hands the customer a PDF at any point.",
  "Expenses are logged along the way, and Reports show what the trip actually made.",
]

export default function InfoPage() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
      <PageHeader
        title="Guide"
        description="What each module is for, what you do in it, and how the pieces fit together."
      />

      {/* How a trip flows through the system */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">How a trip moves through the system</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Most work follows this path. Each step hands its data to the next, so
          nothing is retyped.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {FLOW.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                {index + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Module reference, grouped exactly like the sidebar */}
      {GROUPS.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">{group.label}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{group.blurb}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {group.modules.map((module) => (
              <article
                key={module.href}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <module.icon className="size-4.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={module.href}
                      className="font-medium hover:underline"
                    >
                      {module.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {module.purpose}
                    </p>
                  </div>
                </div>

                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {module.does.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        •
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {module.feeds && (
                  <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Worth knowing: </span>
                    {module.feeds}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {/* Who can see what */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Roles</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A user&rsquo;s role decides which modules appear in their sidebar and
            what they can do inside them. Menu items you cannot use are hidden
            rather than shown greyed out.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <tbody>
              {ROLES.map((role, index) => (
                <tr key={role.name} className={index ? "border-t" : undefined}>
                  <th
                    scope="row"
                    className="w-40 px-4 py-3 text-left align-top font-medium whitespace-nowrap"
                  >
                    {role.name}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{role.sees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Conventions that apply everywhere */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Things that apply everywhere</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Amounts",
              body: "Type rupees as you would say them — 12,500 or 12500.50 both work. Everything is stored to the paise, so totals never drift.",
            },
            {
              title: "GST",
              body: "Tax is calculated on the amount after discount, never before. The rate is set per trip.",
            },
            {
              title: "Document numbers",
              body: "Trips, receipts and expenses are numbered automatically, per financial year. You never type one in.",
            },
            {
              title: "Deleting",
              body: "Records that other data points at refuse to delete and tell you why. Most things are deactivated or cancelled instead, so history survives.",
            },
            {
              title: "Search and filters",
              body: "Filters live in the address bar, so a filtered list can be bookmarked or pasted to a colleague and it opens the same way.",
            },
            {
              title: "Audit trail",
              body: "Creates, edits, cancellations and approvals are recorded with who did them and when.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-4">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Video walkthrough, once one exists */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Video walkthrough</h2>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group w-full max-w-xl overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/30"
        >
          <div className="relative flex aspect-video items-center justify-center bg-muted">
            <PlayCircleIcon className="size-14 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
            <Badge className="absolute right-2 bottom-2">{video.duration}</Badge>
          </div>
          <div className="flex items-start justify-between gap-2 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{video.title}</p>
              <p className="text-xs text-muted-foreground">{video.description}</p>
            </div>
            <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          </div>
        </a>
      </section>
    </div>
  )
}
