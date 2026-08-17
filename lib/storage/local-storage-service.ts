import { randomUUID } from "crypto"
import fs from "fs/promises"
import path from "path"
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  type StorageProvider,
  type UploadFolder,
} from "./types"

/**
 * Stores uploaded files on the server filesystem under:
 *
 *   <UPLOADS_BASE_DIR>/<UPLOADS_PROJECT_NAME>/<folder>/<uuid>.<ext>
 *
 * and exposes them at:
 *
 *   <NEXT_PUBLIC_UPLOADS_BASE_URL>/uploads/<folder>/<uuid>.<ext>
 *
 * The per-project directory is what keeps several apps on the same VPS from
 * colliding: this app writes to `<base>/admin-next-starter/...` while a
 * neighbouring app writes to `<base>/<its own name>/...`. Filenames are random
 * UUIDs on top of that, so even two apps pointed at the same directory by
 * mistake would not overwrite each other's files.
 */

/**
 * Extensions we are willing to write to disk, mapped to the MIME type we expect.
 *
 * This is an allow-list on purpose. The extension comes from an
 * attacker-controlled filename, so without it someone could store `.svg`
 * (script-bearing, served same-origin) or `.html` and get stored XSS.
 */
const ALLOWED_TYPES: Record<string, readonly string[]> = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".avif": ["image/avif"],
  ".bmp": ["image/bmp", "image/x-ms-bmp"],
  ".pdf": ["application/pdf"],
}

/** MIME type -> canonical extension, for uploads with a missing/odd filename. */
const EXTENSION_FOR_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/x-ms-bmp": ".bmp",
  "application/pdf": ".pdf",
}

/** Thrown for problems the user can fix — surfaced verbatim in the UI. */
export class UploadValidationError extends Error {}

export class LocalStorageService implements StorageProvider {
  /** Absolute directory holding this project's uploads. */
  private readonly rootDir: string
  /** Optional absolute origin (e.g. https://erp.example.com) prepended to URLs. */
  private readonly publicBaseUrl: string

  constructor() {
    // Defaults match the VPS layout (/var/www/uploads/<project>). Both are
    // overridable via env so local dev on Windows can point somewhere writable.
    const baseDir = process.env.UPLOADS_BASE_DIR || "/var/www/uploads"
    const projectName = process.env.UPLOADS_PROJECT_NAME || "admin-next-starter"
    // The upload root is runtime state living OUTSIDE the project, so there is
    // nothing here for the build to trace. Left unmarked, the tracer can't
    // resolve the path statically and falls back to pulling the whole project
    // into the standalone output.
    this.rootDir = path.join(/*turbopackIgnore: true*/ baseDir, projectName)
    this.publicBaseUrl = (process.env.NEXT_PUBLIC_UPLOADS_BASE_URL || "").replace(/\/+$/, "")
  }

  async upload(file: File, folder: UploadFolder): Promise<string> {
    const safeFolder = this.normalizeRelative(folder)
    const ext = this.resolveExtension(file)

    if (file.size === 0) {
      throw new UploadValidationError("That file is empty.")
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new UploadValidationError(
        `File is too large. The maximum upload size is ${MAX_UPLOAD_LABEL}.`
      )
    }

    const relativePath = path.posix.join(safeFolder, `${randomUUID()}${ext}`)

    await fs.mkdir(path.join(this.rootDir, safeFolder), { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(this.rootDir, ...relativePath.split("/")), buffer)

    return relativePath
  }

  async delete(stored: string | null | undefined): Promise<void> {
    const relativePath = this.toRelativePath(stored)
    // Not ours (an externally hosted URL pasted in before uploads existed).
    if (!relativePath) return

    try {
      await fs.unlink(this.getAbsolutePath(relativePath))
    } catch (err: unknown) {
      // Missing file is fine — the end state (no file) is what we wanted.
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return
      throw err
    }
  }

  getPublicUrl(relativePath: string | null | undefined): string | null {
    if (!relativePath) return null
    // Already absolute — pass through so external image URLs keep resolving.
    if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith("/")) {
      return relativePath
    }
    return `${this.publicBaseUrl}/uploads/${relativePath.replace(/^\/+/, "")}`
  }

  getAbsolutePath(relativePath: string): string {
    const clean = this.normalizeRelative(relativePath)
    return path.join(this.rootDir, ...clean.split("/"))
  }

  /**
   * Map a stored value back to a path under our upload root, or null when it
   * isn't ours to touch. Accepts the three shapes that can reach the database:
   * a bare relative path, an app-relative `/uploads/...` URL, and a fully
   * qualified URL under `NEXT_PUBLIC_UPLOADS_BASE_URL`.
   */
  toRelativePath(stored: string | null | undefined): string | null {
    if (!stored) return null

    let value = stored.trim()
    if (this.publicBaseUrl && value.startsWith(this.publicBaseUrl)) {
      value = value.slice(this.publicBaseUrl.length)
    }
    // Any remaining absolute URL points at someone else's server.
    if (/^https?:\/\//i.test(value)) return null

    if (value.startsWith("/uploads/")) value = value.slice("/uploads/".length)
    else if (value.startsWith("/")) return null

    try {
      const clean = this.normalizeRelative(value)
      return clean || null
    } catch {
      return null
    }
  }

  // --- helpers -------------------------------------------------------------

  /**
   * Decide the extension to store the file under, rejecting anything outside the
   * allow-list.
   *
   * The filename is attacker-controlled, so it is only trusted far enough to
   * pick between allowed types — and only when it agrees with the declared MIME
   * type. Otherwise the MIME type decides, and if that isn't allowed either the
   * upload is refused rather than written to disk.
   */
  private resolveExtension(file: File): string {
    const mime = (file.type || "").toLowerCase().split(";")[0].trim()
    const fromName = path.extname(file.name || "").toLowerCase()

    const allowedForExt = ALLOWED_TYPES[fromName]
    if (allowedForExt && (!mime || allowedForExt.includes(mime))) return fromName

    const fromMime = EXTENSION_FOR_MIME[mime]
    if (fromMime) return fromMime

    throw new UploadValidationError(
      "Unsupported file type. Please upload a PNG, JPEG, WebP, GIF, AVIF, BMP or PDF file."
    )
  }

  /** Defend against `..` traversal escaping the uploads root. */
  private normalizeRelative(relativePath: string): string {
    const clean = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
    if (clean.split("/").some((segment) => segment === "..")) {
      throw new Error(`Invalid storage path: ${relativePath}`)
    }
    return clean
  }
}
