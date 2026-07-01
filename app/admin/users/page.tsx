import { UsersIcon } from "lucide-react"

export default function UsersPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your application users and their roles.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-card/50">
        <div className="flex flex-col items-center gap-3 text-center p-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UsersIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">No users yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Users will appear here once authentication is set up.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
