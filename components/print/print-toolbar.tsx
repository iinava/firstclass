import Link from "next/link"
import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Controls above the on-screen PDF preview; hidden in the PDF itself. The
 * download is generated on the server, so it's a plain link, not a print.
 */
export function PrintToolbar({
  downloadHref,
  backHref,
  backLabel,
}: {
  downloadHref: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div
      data-print-hide
      className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between gap-2 print:hidden"
    >
      {backHref ? (
        <Button variant="ghost" size="sm" render={<Link href={backHref} />}>
          <ArrowLeftIcon data-icon="inline-start" />
          {backLabel ?? "Back"}
        </Button>
      ) : (
        <span />
      )}
      <Button size="sm" render={<a href={downloadHref} download />}>
        <DownloadIcon data-icon="inline-start" />
        Download PDF
      </Button>
    </div>
  )
}
