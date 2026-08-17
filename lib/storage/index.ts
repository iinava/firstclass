import { LocalStorageService } from "./local-storage-service"
import type { StorageProvider } from "./types"

/**
 * The single place that decides which storage backend the app uses.
 *
 * To move to S3 / MinIO / ImageKit later, implement `StorageProvider` in a new
 * class and swap the line below — nothing else in the codebase changes.
 */
export const storage: StorageProvider = new LocalStorageService()

export { UploadValidationError } from "./local-storage-service"
export type { StorageProvider, UploadFolder } from "./types"
