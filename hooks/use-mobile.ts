import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Viewport width is external state, so it is read with useSyncExternalStore
 * rather than mirrored into React state from an effect. That avoids the extra
 * render pass on mount and gives a defined value on the very first paint.
 *
 * The server snapshot is `false` — the server has no viewport, and desktop is
 * the safe assumption for an admin panel.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
