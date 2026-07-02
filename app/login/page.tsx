import { ShieldIcon } from "lucide-react"
import { LoginForm } from "@/app/login/_components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <ShieldIcon className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
