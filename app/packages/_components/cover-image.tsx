"use client"

import * as React from "react"
import { ImageIcon } from "lucide-react"

/**
 * Cover photo with a placeholder fallback.
 *
 * Images are plain URLs typed in by staff, so a dead link is a matter of when,
 * not if — and a broken-image icon on the page a customer is shopping from
 * looks worse than no photo at all. This is the only interactive part of the
 * catalogue, which is why it is the only client component on it.
 */
export function CoverImage({
  src,
  alt,
  className,
}: {
  src: string | null
  alt: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="size-8 text-muted-foreground/40" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
