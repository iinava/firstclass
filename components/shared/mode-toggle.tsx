"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Toggle } from "@/components/ui/toggle"

const noopSubscribe = () => () => {}

/**
 * The server can't know the client's theme, so the first client render must
 * match the server's. `useSyncExternalStore` gives us that hydration-safe flag
 * without mirroring it through state in an effect.
 */
function useHydrated() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const isDark = hydrated ? theme === "dark" : false

  return (
    <Toggle
      variant="outline"
      className="w-8 h-8 p-0"
      pressed={isDark}
      onPressedChange={(pressed) => setTheme(pressed ? "dark" : "light")}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Toggle>
  )
}
