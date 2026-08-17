import { NextResponse } from "next/server"
import { hasPermission, type Permission } from "@/lib/rbac"
import { getSession } from "@/lib/session"
import { storage, UploadValidationError } from "@/lib/storage"
import { UPLOAD_FOLDERS, type UploadFolder } from "@/lib/storage/types"

/**
 * File upload endpoint.
 *
 * Uploads go through a route handler rather than a server action because
 * `defineAction` takes plain JSON-serialisable input, and multipart bodies
 * larger than `serverActions.bodySizeLimit` are rejected before the action ever
 * runs — which leaves a form stuck pending with nothing to report.
 *
 * `proxy.ts` only matches /admin and /login, so this route is NOT covered by it
 * and does its own session + permission check. It has to: a route handler is a
 * public HTTP endpoint regardless of which page rendered the picker.
 *
 * The response mirrors the ActionResult shape used everywhere else so client
 * error handling reads the same.
 */

/** Which permission each folder demands. Doubles as the folder allow-list. */
const FOLDER_PERMISSION: Record<UploadFolder, Permission> = {
  itineraries: "itinerary:update",
  "itinerary-photos": "itinerary:update",
  expenses: "expense:create",
}

const isUploadFolder = (value: unknown): value is UploadFolder =>
  typeof value === "string" && (UPLOAD_FOLDERS as readonly string[]).includes(value)

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return fail("Your session has expired. Please sign in again.", 401)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail("That upload could not be read. Please try again.", 400)
  }

  const folder = form.get("folder")
  if (!isUploadFolder(folder)) return fail("Unknown upload destination.", 400)

  if (!hasPermission(session.role, FOLDER_PERMISSION[folder])) {
    return fail("You do not have permission to upload here.", 403)
  }

  const file = form.get("file")
  if (!(file instanceof File)) return fail("No file was received.", 400)

  try {
    const relativePath = await storage.upload(file, folder)
    // The public URL is what gets stored on the record, so existing read paths
    // (plain <img src>) keep working untouched.
    return NextResponse.json({ ok: true, data: { url: storage.getPublicUrl(relativePath) } })
  } catch (error) {
    if (error instanceof UploadValidationError) return fail(error.message, 400)
    console.error("[api:uploads] upload failed", error)
    return fail("The upload failed. Please try again.", 500)
  }
}

/**
 * Discards a file uploaded moments ago but never saved — the user replaced or
 * cleared the picture before submitting the form. Silently ignores anything
 * that isn't ours, so a stray external URL can't be used to probe the disk.
 */
export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return fail("Your session has expired. Please sign in again.", 401)

  const url = new URL(request.url).searchParams.get("url")
  const relativePath = storage.toRelativePath(url)
  if (!relativePath) return NextResponse.json({ ok: true, data: { discarded: false } })

  const folder = relativePath.split("/")[0]
  if (!isUploadFolder(folder)) return fail("Unknown upload destination.", 400)
  if (!hasPermission(session.role, FOLDER_PERMISSION[folder])) {
    return fail("You do not have permission to remove this file.", 403)
  }

  try {
    await storage.delete(relativePath)
  } catch (error) {
    // Best-effort: a leftover file is a housekeeping problem, not a user-facing
    // failure. The form it belongs to has already moved on.
    console.error("[api:uploads] discard failed", error)
  }
  return NextResponse.json({ ok: true, data: { discarded: true } })
}
