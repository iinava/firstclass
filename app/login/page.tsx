"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { ShieldIcon } from "lucide-react"
import { login } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginSchema, type LoginInput } from "@/validations/auth.validation"

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()

  const form = useForm<LoginInput>({
    resolver: standardSchemaResolver(LoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form

  function onSubmit(data: LoginInput) {
    startTransition(async () => {
      const result = await login(data)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

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

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

          {/* Username */}
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Enter your username"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "username-error" : undefined}
              {...register("username")}
            />
            {errors.username && (
              <p id="username-error" className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  )
}
