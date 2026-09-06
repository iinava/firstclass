"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Print controls — hidden in the printed output itself. */
export function PrintButton() {
  const router = useRouter()

  // Opening the page from the trip is always to print, so start the dialog —
  // but only once Poppins has actually arrived. Printing over a fallback font
  // reflows the letterhead, and the printed sheet is what the client sees.
  React.useEffect(() => {
    let cancelled = false
    const print = () => {
      if (!cancelled) window.print()
    }
    // A font that never resolves must not leave the dialog unopened.
    const timer = setTimeout(print, 2500)
    document.fonts.ready.then(() => {
      clearTimeout(timer)
      setTimeout(print, 150)
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div
      data-print-hide
      className="mb-4 flex items-center justify-between print:hidden"
    >
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
