import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { storage } from "@/lib/storage"

// Serves files written by LocalStorageService at /uploads/<relative-path>.
//
// PRODUCTION NOTE: on the VPS let Nginx serve these directly — it intercepts
// before the app ever runs, which is both faster and keeps large files off the
// Node process. See .env.example for the `location /uploads/` block. This
// handler is the portable fallback so uploads also work in local dev and on
// hosts without that alias configured.
//
// Uploaded files are intentionally public: `proxy.ts` only matches /admin and
// /login, and the shared itinerary page (/i/<token>) has to render photos for
// customers who have no session. Filenames are unguessable UUIDs.

// Raster formats and PDF only. SVG is deliberately absent: it can carry
// <script>, and serving it as image/svg+xml from this origin would run that
// script against the app's own session cookie. Anything not listed is served as
// an opaque download instead of being rendered.
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const relativePath = (segments ?? []).join("/")

  if (!relativePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let absolutePath: string
  try {
    // Rejects path-traversal (`..`) attempts.
    absolutePath = storage.getAbsolutePath(relativePath)
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  try {
    const file = await fs.readFile(absolutePath)
    const contentType = CONTENT_TYPES[path.extname(absolutePath).toLowerCase()]

    const headers: Record<string, string> = {
      "Content-Type": contentType ?? "application/octet-stream",
      // Filenames are content-addressed by UUID, so a file at a given URL never
      // changes — it is replaced by a new URL.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Never let the browser second-guess the type we declare — sniffing is
      // what turns a mislabelled upload into an executable document.
      "X-Content-Type-Options": "nosniff",
    }

    // Unrecognised type: force a download rather than inline rendering, so a
    // file that somehow slipped past the upload allow-list still can't run.
    if (!contentType) headers["Content-Disposition"] = "attachment"

    return new NextResponse(new Uint8Array(file), { status: 200, headers })
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}
