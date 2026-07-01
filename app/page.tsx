import Link from "next/link"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-muted-foreground text-sm">This page doesn&apos;t exist yet.</p>
      <Link href="/admin" className="text-sm underline underline-offset-4 hover:text-foreground transition-colors">
        Go to Admin Panel →
      </Link>
    </div>
  )
}
