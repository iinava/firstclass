import { AlertTriangleIcon, ShieldIcon } from "lucide-react"
import { LoginForm } from "@/app/login/_components/login-form"

const REASONS: Record<string, string> = {
  deactivated:
    "Your account has been deactivated. Contact an administrator for access.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = reason ? REASONS[reason] : undefined

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <ShieldIcon className="size-6" />
          </div>
        </div>

        {/* Explains why an active session was ended, rather than silently
            dropping the user back at the login form. */}
        {message && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  )
}
