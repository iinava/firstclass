import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { deleteSession } from "@/lib/session"

/**
 * Clears the session cookie and returns to the login page.
 *
 * This exists as a Route Handler because cookies cannot be modified while a
 * Server Component renders. The admin layout redirects here when a user's
 * account has been deactivated or deleted — simply redirecting to /login would
 * loop, since the proxy sees a still-valid JWT and sends them back to /admin.
 */
export async function GET(request: NextRequest) {
  await deleteSession()

  const reason = request.nextUrl.searchParams.get("reason")
  const url = new URL("/login", request.url)
  if (reason) url.searchParams.set("reason", reason)

  return NextResponse.redirect(url)
}
