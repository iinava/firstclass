"use client"

import * as React from "react"

/**
 * An image that removes itself when the file is missing, so a dead link never
 * shows a broken-image box. Its container decides the size; this only fills it.
 *
 * `eager` is for printed documents: a lazy image below the fold is still blank
 * when the PDF is captured.
 */
export function SafeImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string
  alt: string
  className?: string
  eager?: boolean
}) {
  const ref = React.useRef<HTMLImageElement>(null)
  const [failed, setFailed] = React.useState(false)

  // The image is in the server HTML, so it can fail before React hydrates and
  // attaches onError. Catch that case by looking at it once mounted.
  React.useEffect(() => {
    const image = ref.current
    if (image?.complete && image.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
