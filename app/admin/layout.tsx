import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { verifySession } from "@/lib/session"
import { getUser } from "@/lib/services/user.service"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  // Sessions are stateless JWTs valid for 7 days, so revoking access has to be
  // re-checked against the database — otherwise a deactivated or demoted user
  // keeps their old permissions until the token expires.
  const user = await getUser(session.userId)
  if (!user || !user.isActive) {
    // Via /logout, not /login: the cookie has to be cleared in a Route Handler,
    // and the proxy would otherwise bounce a still-valid JWT straight back here.
    redirect("/logout?reason=deactivated")
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: user.name ?? user.username, role: user.role }}
      />
      <SidebarInset className="min-w-0">
        <AdminHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
