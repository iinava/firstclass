"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BanknoteIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
  LayoutDashboardIcon,
  MapIcon,
  MapPinnedIcon,
  ReceiptIcon,
  Settings2Icon,
  ShieldIcon,
  Store,
  UserRoundCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { hasAnyPermission, type Permission } from "@/lib/rbac"
import type { UserRole } from "@/types/auth"

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  /** Item is hidden unless the user holds at least one of these. */
  permissions: Permission[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/admin",
        icon: LayoutDashboardIcon,
        permissions: ["dashboard:view"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Enquiries",
        url: "/admin/leads",
        icon: BriefcaseIcon,
        permissions: ["lead:view"],
      },
      {
        title: "Follow-ups",
        url: "/admin/followups",
        icon: CalendarCheckIcon,
        permissions: ["lead:view"],
      },
      {
        title: "Customers",
        url: "/admin/customers",
        icon: UsersIcon,
        permissions: ["customer:view"],
      },
      {
        title: "Packages",
        url: "/admin/packages",
        icon: MapIcon,
        permissions: ["itinerary:view"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Trips",
        url: "/admin/trips",
        icon: MapPinnedIcon,
        permissions: ["booking:view"],
      },
      {
        title: "Suppliers",
        url: "/admin/suppliers",
        icon: Store,
        permissions: ["supplier:view"],
      },
      {
        title: "Fleet",
        url: "/admin/fleet",
        icon: BusIcon,
        permissions: ["vehicle:view"],
      },
    ],
  },
  {
    label: "Accounts",
    items: [
      {
        title: "Payments",
        url: "/admin/payments",
        icon: WalletIcon,
        permissions: ["payment:view"],
      },
      {
        title: "Expenses",
        url: "/admin/expenses",
        icon: ReceiptIcon,
        permissions: ["expense:view"],
      },
      {
        title: "Reports",
        url: "/admin/reports",
        icon: ChartNoAxesCombinedIcon,
        // Matches the page's own gate — see app/admin/reports/page.tsx.
        permissions: ["report:financial"],
      },
    ],
  },
  {
    label: "Team",
    items: [
      {
        title: "Employees",
        url: "/admin/employees",
        icon: UserRoundCheckIcon,
        permissions: ["hrms:view"],
      },
      {
        title: "Attendance",
        // The register and the approval queue — matches the page's own gate,
        // which is hrms:view alone.
        url: "/admin/attendance",
        icon: CalendarCheckIcon,
        permissions: ["hrms:view"],
      },
      {
        title: "Payroll",
        url: "/admin/payroll",
        icon: BanknoteIcon,
        permissions: ["payroll:view"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Users",
        url: "/admin/users",
        icon: ShieldIcon,
        permissions: ["user:view"],
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings2Icon,
        permissions: ["settings:view"],
      },
      {
        title: "User Manual",
        url: "/admin/info",
        icon: BookOpenIcon,
        permissions: ["dashboard:view"],
      },
    ],
  },
]

type SidebarUser = {
  name: string
  role: UserRole
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  const pathname = usePathname()

  // Hiding a link is presentation only — every route and action re-checks the
  // same permission on the server.
  const groups = React.useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          hasAnyPermission(user.role, item.permissions)
        ),
      })).filter((group) => group.items.length > 0),
    [user.role]
  )

  const isActive = (url: string) =>
    url === "/admin" ? pathname === "/admin" : pathname.startsWith(url)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">First Class</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Travel ERP
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                    render={<Link href={item.url} prefetch />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
