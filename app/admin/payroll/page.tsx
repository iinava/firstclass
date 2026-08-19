import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { requirePermission } from "@/lib/action"
import { hasPermission } from "@/lib/rbac"
import { PayrollView } from "./_components/payroll-view"

export const metadata: Metadata = { title: "Payroll" }

export default async function PayrollPage() {
  const session = await requirePermission("payroll:view")

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <PageHeader
        title="Payroll"
        description="What each employee is owed this month, read off the attendance register."
      />
      <PayrollView canPost={hasPermission(session.role, "payroll:run")} />
    </div>
  )
}
