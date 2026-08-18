"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Print controls — hidden in the printed output itself. */
export function PrintButton() {
  const router = useRouter()

  // Opening the page from the trip is always to print, so start the dialog.
  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="mb-4 flex items-center justify-between print:hidden">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeftIcon data-icon="inline-start" />
        Back to trip
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <PrinterIcon data-icon="inline-start" />
        Print / Save as PDF
      </Button>
    </div>
  )
}
