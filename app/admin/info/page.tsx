import { PlayCircleIcon, ExternalLinkIcon } from "lucide-react"

// Replace with the actual guide video URL and details
const guide = {
  title: "How to Use the Admin Panel",
  description: "A complete walkthrough of everything you need to know to operate this admin panel.",
  url: "#",
  duration: "10 min",
}

export default function InfoPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Watch the video below to learn how to use this admin panel.
        </p>
      </div>

      <a
        href={guide.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group w-full max-w-xl rounded-xl border bg-card overflow-hidden hover:border-foreground/30 transition-colors"
      >
        {/* Thumbnail placeholder */}
        <div className="relative flex aspect-video items-center justify-center bg-muted">
          <PlayCircleIcon className="size-14 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white font-medium">
            {guide.duration}
          </span>
        </div>

        {/* Info */}
        <div className="flex items-start justify-between gap-2 p-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">{guide.title}</p>
            <p className="text-xs text-muted-foreground">{guide.description}</p>
          </div>
          <ExternalLinkIcon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        </div>
      </a>
    </div>
  )
}
