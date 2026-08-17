"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import { FileTextIcon, ImagePlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  ACCEPTED_DOCUMENT_LABEL,
  ACCEPTED_DOCUMENT_MIME,
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  type UploadFolder,
} from "@/lib/storage/types"

/**
 * File upload plumbing shared by every picker.
 *
 * Files are uploaded the moment they are picked, and the field holds the
 * resulting URL — so the form itself still submits a plain string and the
 * existing server actions, zod schemas and `<img src>` read paths are unchanged.
 * The cost is that a file uploaded into a dialog the user then cancels is
 * orphaned on disk; `discardUpload` covers the replace/remove case, and the
 * remainder is cheap enough to sweep periodically.
 */

/** Uploads one file and resolves to the stored URL. Throws a user-safe message. */
export async function uploadToStorage(file: File, folder: UploadFolder): Promise<string> {
  // Checked again on the server; this is here so a 12 MB photo fails instantly
  // instead of after the whole body has been pushed up a slow connection.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The maximum size is ${MAX_UPLOAD_LABEL}.`
    )
  }

  const body = new FormData()
  body.append("file", file)
  body.append("folder", folder)

  const response = await fetch("/api/uploads", { method: "POST", body })
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "The upload failed. Please try again.")
  }
  return payload.data.url as string
}

/** Best-effort cleanup for a file that was uploaded but never saved. */
export function discardUpload(url: string | null | undefined): void {
  if (!url) return
  void fetch(`/api/uploads?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(
    () => {}
  )
}

const isPdf = (url: string) => url.toLowerCase().split("?")[0].endsWith(".pdf")

/**
 * Single-file upload bound to a react-hook-form field holding the stored URL.
 *
 * Values already in the database that point at an external host still render
 * and can still be cleared — only files we uploaded ourselves are unlinked.
 */
export function ImageUploadField<T extends FieldValues>({
  control,
  name,
  label,
  folder,
  description,
  disabled,
  className,
  /** Accept PDFs as well as images (bills and receipts are often scanned). */
  allowDocuments = false,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  folder: UploadFolder
  description?: string
  disabled?: boolean
  className?: string
  allowDocuments?: boolean
}) {
  const id = `field-${name}`
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  // Files uploaded during this mount and not (yet) saved. Anything still listed
  // here when it leaves the field is ours to clean up; a URL loaded from the
  // record is not, because the record still points at it until the form saves.
  const sessionUploads = React.useRef<Set<string>>(new Set())

  const accept = allowDocuments ? ACCEPTED_DOCUMENT_MIME : ACCEPTED_IMAGE_MIME
  const formats = allowDocuments ? ACCEPTED_DOCUMENT_LABEL : ACCEPTED_IMAGE_LABEL

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value: string = typeof field.value === "string" ? field.value : ""
        const fileName = value.split("/").pop() || value

        const replace = (next: string) => {
          const previous = value
          field.onChange(next)
          field.onBlur()
          if (previous && sessionUploads.current.has(previous)) {
            sessionUploads.current.delete(previous)
            discardUpload(previous)
          }
        }

        const handlePick = async (file: File | undefined) => {
          if (!file) return
          setIsUploading(true)
          try {
            const url = await uploadToStorage(file, folder)
            sessionUploads.current.add(url)
            replace(url)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "The upload failed")
          } finally {
            setIsUploading(false)
            // Clear the input so picking the same file again still fires change.
            if (inputRef.current) inputRef.current.value = ""
          }
        }

        return (
          <Field
            data-invalid={fieldState.invalid}
            data-disabled={disabled}
            className={className}
          >
            <FieldLabel htmlFor={id}>{label}</FieldLabel>

            <input
              ref={inputRef}
              id={id}
              type="file"
              accept={accept}
              className="sr-only"
              disabled={disabled || isUploading}
              onChange={(event) => void handlePick(event.target.files?.[0])}
            />

            {value ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                {isPdf(value) ? (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileTextIcon className="size-6 text-muted-foreground" />
                  </div>
                ) : (
                  // Uploads and pasted external URLs alike, so a plain img
                  // avoids next/image remote patterns for every possible host.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={value}
                    alt=""
                    className="size-16 shrink-0 rounded-md border object-cover"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm underline-offset-4 hover:underline"
                  >
                    {fileName}
                  </a>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled || isUploading}
                      onClick={() => inputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <UploadIcon data-icon="inline-start" />
                      )}
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || isUploading}
                      onClick={() => replace("")}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-center border-dashed py-6"
                disabled={disabled || isUploading}
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ImagePlusIcon data-icon="inline-start" />
                )}
                {isUploading ? "Uploading…" : "Choose a file"}
              </Button>
            )}

            {!fieldState.error && (
              <FieldDescription>
                {description ? `${description} ` : ""}
                {formats}, up to {MAX_UPLOAD_LABEL}.
              </FieldDescription>
            )}
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
