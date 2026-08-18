import { Settings2Icon } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage application configuration and preferences.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-card/50">
        <div className="flex flex-col items-center gap-3 text-center p-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Settings2Icon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Settings coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              Application settings will be added here as the project grows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
