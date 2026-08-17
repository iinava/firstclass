"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  ImagePlusIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UtensilsIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  discardUpload,
  uploadToStorage,
} from "@/components/shared/image-upload-field"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { unwrapAction, useActionMutation } from "@/hooks/use-action-mutation"
import { formatDuration } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { qk } from "@/lib/query-keys"
import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME,
  MAX_IMAGES_PER_ITINERARY,
  MAX_UPLOAD_LABEL,
} from "@/lib/storage/types"
import {
  ITINERARY_STATUSES,
  ITINERARY_STATUS_LABELS,
} from "@/validations/itinerary.validation"
import type { ItineraryDay } from "@/db/schemas/itinerary.schema"
import {
  addImage,
  deleteDay,
  deleteImage,
  fetchItineraryDetail,
  regenerateShareToken,
  updateItineraryStatus,
} from "../../actions"
import { DayEditorDialog } from "./day-editor-dialog"

export function ItineraryEditor({ itineraryId }: { itineraryId: string }) {
  const { data } = useQuery({
    queryKey: qk.itineraries.detail(itineraryId),
    queryFn: async () => unwrapAction(await fetchItineraryDetail({ id: itineraryId })),
  })

  const [dayOpen, setDayOpen] = React.useState(false)
  const [editingDay, setEditingDay] = React.useState<ItineraryDay | null>(null)
  const [deletingDay, setDeletingDay] = React.useState<ItineraryDay | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const statusMutation = useActionMutation({
    action: updateItineraryStatus,
    successMessage: "Status updated",
    invalidate: [qk.itineraries.all],
  })

  const removeDayMutation = useActionMutation({
    action: deleteDay,
    successMessage: "Day removed",
    invalidate: [qk.itineraries.all],
    onSuccess: () => setDeletingDay(null),
  })

  const removeImageMutation = useActionMutation({
    action: deleteImage,
    successMessage: "Photo removed",
    invalidate: [qk.itineraries.all],
  })

  const resetLinkMutation = useActionMutation({
    action: regenerateShareToken,
    successMessage: "Share link reset — the old link no longer works",
    invalidate: [qk.itineraries.all],
  })

  if (!data) return null
  const { itinerary, days, images } = data

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/i/${itinerary.shareToken}`
      : `/i/${itinerary.shareToken}`

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Share link copied", { description: shareUrl })
    } catch {
      toast.info("Copy this link", { description: shareUrl, duration: 10000 })
    }
  }

  /**
   * Uploads each picked file and attaches it to the itinerary.
   *
   * One at a time rather than in parallel: the gallery is ordered by
   * `sortOrder`, and a failed upload halfway through should leave the photos
   * before it saved rather than roll the whole batch back. A file that uploads
   * but fails to attach is discarded so it doesn't linger unreferenced on disk.
   */
  const handleFiles = async (picked: FileList | null) => {
    if (!picked?.length) return

    const slots = MAX_IMAGES_PER_ITINERARY - images.length
    if (slots <= 0) {
      toast.error(`An itinerary can hold at most ${MAX_IMAGES_PER_ITINERARY} photos.`)
      return
    }
    const files = [...picked].slice(0, slots)
    if (files.length < picked.length) {
      toast.warning(`Only ${slots} more photo${slots > 1 ? "s" : ""} will fit — the rest were skipped.`)
    }

    setIsUploading(true)
    let added = 0
    try {
      for (const [index, file] of files.entries()) {
        let url: string
        try {
          url = await uploadToStorage(file, "itinerary-photos")
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Could not upload "${file.name}"`)
          continue
        }

        const result = await addImage({
          itineraryId,
          url,
          sortOrder: images.length + index,
        } as never)

        if (!result.ok) {
          discardUpload(url)
          toast.error(result.error)
          continue
        }
        added++
      }
    } finally {
      setIsUploading(false)
      // Clear the input so re-picking the same file still fires change.
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (added > 0) {
        toast.success(`${added} photo${added > 1 ? "s" : ""} added`)
        void queryClient.invalidateQueries({ queryKey: qk.itineraries.all })
      }
    }
  }

  const price =
    itinerary.pricingMode === "per_pax" ? itinerary.pricePerAdult : itinerary.fixedPrice

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2"
        render={<Link href="/admin/packages" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        All itineraries
      </Button>

      <PageHeader
        title={itinerary.title}
        description={`${itinerary.code} · ${formatDuration(itinerary.durationDays, itinerary.durationNights)}${
          price
            ? ` · ${formatMoney(price)}${itinerary.pricingMode === "per_pax" ? " per person" : ""}`
            : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={itinerary.status} />
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <LinkIcon data-icon="inline-start" />
              Copy link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" />}>Actions</DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  render={
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <ExternalLinkIcon className="size-4" />
                  Preview shared page
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={resetLinkMutation.isPending}
                  onClick={() => resetLinkMutation.mutate({ id: itineraryId })}
                >
                  <RefreshCwIcon className="size-4" />
                  Reset share link
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                {/* The label is a group part — outside DropdownMenuGroup Base UI
                    throws and the whole page falls into the error boundary. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Set status
                  </DropdownMenuLabel>
                  {ITINERARY_STATUSES.filter((s) => s !== itinerary.status).map(
                    (status) => (
                      <DropdownMenuItem
                        key={status}
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: itineraryId, status } as never)
                        }
                      >
                        {ITINERARY_STATUS_LABELS[status]}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Day-by-day */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Day by day</h2>
            <p className="text-xs text-muted-foreground">
              {days.length} of {itinerary.durationDays} days added
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingDay(null)
              setDayOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add day
          </Button>
        </div>

        {days.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">No days yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              An itinerary needs at least one day before it can be shared.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {days.map((day) => (
              <li key={day.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Day {day.dayNumber}
                    </p>
                    <h3 className="mt-0.5 font-medium">{day.title}</h3>
                    {day.description && (
                      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                        {day.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {day.stayNote && <span>Stay: {day.stayNote}</span>}
                      {(day.breakfast || day.lunch || day.dinner) && (
                        <span className="inline-flex items-center gap-1">
                          <UtensilsIcon className="size-3" />
                          {[
                            day.breakfast && "Breakfast",
                            day.lunch && "Lunch",
                            day.dinner && "Dinner",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit day ${day.dayNumber}`}
                      onClick={() => {
                        setEditingDay(day)
                        setDayOpen(true)
                      }}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete day ${day.dayNumber}`}
                      onClick={() => setDeletingDay(day)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Photos */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Photos</h2>
          <p className="text-xs text-muted-foreground">
            Shown in the gallery on the shared page. {ACCEPTED_IMAGE_LABEL}, up to{" "}
            {MAX_UPLOAD_LABEL} each — {images.length} of {MAX_IMAGES_PER_ITINERARY} used.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            id="itinerary-photos"
            type="file"
            accept={ACCEPTED_IMAGE_MIME}
            multiple
            className="sr-only"
            disabled={isUploading || images.length >= MAX_IMAGES_PER_ITINERARY}
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-center border-dashed py-6"
            disabled={isUploading || images.length >= MAX_IMAGES_PER_ITINERARY}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ImagePlusIcon data-icon="inline-start" />
            )}
            {isUploading
              ? "Uploading…"
              : images.length >= MAX_IMAGES_PER_ITINERARY
                ? "No slots left"
                : "Add photos"}
          </Button>
        </div>

        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <li
                key={image.id}
                className="group relative overflow-hidden rounded-lg border bg-muted"
              >
                {/* Arbitrary external URLs, so a plain img avoids next/image
                    remote-pattern configuration for every possible host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.caption ?? "Itinerary photo"}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                <Button
                  variant="destructive"
                  size="icon-sm"
                  className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Remove photo"
                  onClick={() => removeImageMutation.mutate({ id: image.id })}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DayEditorDialog
        open={dayOpen}
        onOpenChange={(open) => {
          setDayOpen(open)
          if (!open) setEditingDay(null)
        }}
        itineraryId={itineraryId}
        day={editingDay}
        nextDayNumber={days.length + 1}
      />

      <ConfirmDialog
        open={Boolean(deletingDay)}
        onOpenChange={(open) => !open && setDeletingDay(null)}
        title={`Delete day ${deletingDay?.dayNumber}?`}
        description="This removes the day from the itinerary and the shared page."
        confirmLabel="Delete"
        variant="destructive"
        isPending={removeDayMutation.isPending}
        onConfirm={() => deletingDay && removeDayMutation.mutate({ id: deletingDay.id })}
      />
    </div>
  )
}
