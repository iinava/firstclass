"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Dashboard",
  attendance: "Attendance",
  customers: "Customers",
  employees: "Employees",
  expenses: "Expenses",
  fleet: "Fleet",
  followups: "Follow-ups",
  info: "Guide",
  invoice: "Invoice",
  leads: "Enquiries",
  packages: "Packages",
  payments: "Payments",
  reports: "Reports",
  settings: "Settings",
  suppliers: "Suppliers",
  trips: "Trips",
  users: "Users",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function AdminHeader() {
  const pathname = usePathname()

  const crumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)

    return segments
      .map((segment, index) => ({
        segment,
        href: "/" + segments.slice(0, index + 1).join("/"),
      }))
      // A record id is not a place — showing the raw UUID as a crumb was pure
      // noise, and the page title underneath already names the record.
      .filter(({ segment }) => !UUID.test(segment))
      .map(({ segment, href }, index, list) => ({
        href,
        label:
          SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
        isLast: index === list.length - 1,
      }))
  }, [pathname])

  return (
    <header
      data-print-hide
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm"
    >
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:gap-1.5">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
              <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden md:block" : ""}>
                {crumb.isLast ? (
                  <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
