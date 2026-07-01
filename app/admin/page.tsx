import { UsersIcon, ActivityIcon, ServerIcon, TrendingUpIcon } from "lucide-react"

const stats = [
  {
    label: "Total Users",
    value: "1,284",
    sub: "+12% from last month",
    icon: UsersIcon,
  },
  {
    label: "Active Sessions",
    value: "42",
    sub: "Currently online",
    icon: ActivityIcon,
  },
  {
    label: "API Requests",
    value: "18.2k",
    sub: "Today so far",
    icon: TrendingUpIcon,
  },
  {
    label: "System Uptime",
    value: "99.9%",
    sub: "This month",
    icon: ServerIcon,
  },
]

const recentUsers = [
  { name: "John Doe", username: "johndoe", role: "admin", joined: "2 hours ago" },
  { name: "Jane Smith", username: "janesmith", role: "staff", joined: "Yesterday" },
  { name: "Bob Wilson", username: "bobwilson", role: "staff", joined: "2 days ago" },
  { name: "Alice Chen", username: "alicechen", role: "developer", joined: "3 days ago" },
  { name: "Mike Torres", username: "miketorres", role: "staff", joined: "1 week ago" },
]

const roleBadgeClass: Record<string, string> = {
  superadmin: "bg-red-500/10 text-red-400 border-red-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  developer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  staff: "bg-green-500/10 text-green-400 border-green-500/20",
  customer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
}

export default function AdminDashboard() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your application today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent users table */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-medium text-sm">Recent Users</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Latest accounts created in the system</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Username</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.username} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{user.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">@{user.username}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${roleBadgeClass[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{user.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
