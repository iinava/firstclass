// Storage provider abstraction.
//
// Everything the app does with uploaded files goes through this interface, so
// swapping the backing store later (S3 / MinIO / ImageKit) means writing one new
// class that implements `StorageProvider` and changing the single export in
// `lib/storage/index.ts` — no call sites change.
//
// This module is deliberately dependency-free (no `server-only`, no `fs`) so
// client components can import the limits and folder names for pre-flight
// validation.

/**
 * Largest file any provider will accept, in bytes. Checked on the client before
 * the request goes out and again on the server, which is the check that counts.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const MAX_UPLOAD_LABEL = `${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`

/** How many photos one itinerary gallery may hold. */
export const MAX_IMAGES_PER_ITINERARY = 12

/**
 * Sub-directories inside this project's upload root, one per entity that owns
 * files. Uploads name their folder, and the API route rejects anything not
 * listed here — otherwise the folder is caller-controlled and becomes a way to
 * scatter files anywhere under the root.
 */
export const UPLOAD_FOLDERS = [
  "itineraries", // itinerary cover images
  "itinerary-photos", // itinerary gallery photos
  "expenses", // expense bills / receipts
] as const

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number]

/** Human copy for the accepted formats, shared by every upload field. */
export const ACCEPTED_IMAGE_LABEL = "PNG, JPEG, WebP, GIF, AVIF or BMP"
export const ACCEPTED_IMAGE_MIME = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
/** Bills are often scanned to PDF, so that one field accepts documents too. */
export const ACCEPTED_DOCUMENT_LABEL = `${ACCEPTED_IMAGE_LABEL} or PDF`
export const ACCEPTED_DOCUMENT_MIME = `${ACCEPTED_IMAGE_MIME},application/pdf`

export interface StorageProvider {
  /**
   * Persist an uploaded file under `folder` and return the RELATIVE path to
   * store, e.g. `itineraries/8c2d0a8b.webp`. Never an absolute filesystem path.
   */
  upload(file: File, folder: UploadFolder): Promise<string>

  /**
   * Remove a previously stored file. Accepts either the relative path or the
   * public URL that was saved in the database. Missing files are treated as
   * success (idempotent delete); anything that isn't ours (an external
   * https:// link a user pasted before uploads existed) is ignored.
   */
  delete(stored: string | null | undefined): Promise<void>

  /**
   * Turn a stored relative path into a URL the browser can load, e.g.
   * `itineraries/8c2d0a8b.webp` -> `/uploads/itineraries/8c2d0a8b.webp`.
   * Values that are already absolute (http(s):// or a leading `/`) pass through
   * unchanged, so externally hosted images keep working.
   */
  getPublicUrl(relativePath: string | null | undefined): string | null

  /**
   * Resolve a stored path to an absolute path on disk, for server-side
   * consumers that need the raw bytes. Throws on path traversal.
   */
  getAbsolutePath(relativePath: string): string

  /** Inverse of `getPublicUrl`: our own URL back to a relative path, else null. */
  toRelativePath(stored: string | null | undefined): string | null
}
