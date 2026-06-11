import Link from "next/link"
import type { Chapter } from "@/lib/api"
import { timeAgo, proxyImage } from "@/lib/api"

export function ChapterCard({ chapter }: { chapter: Chapter }) {
  const title = chapter.seriesTitle || chapter.title
  // Goes to detail komik page first
  const href = `/detail/${chapter.id}`

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyImage(chapter.thumbnail) || "/placeholder.svg?height=400&width=300&query=manga%20cover"}
          alt={title}
          loading="lazy"
          crossOrigin="anonymous"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {chapter.chapterNumber ? (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow">
            Ch. {chapter.chapterNumber}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary">
          {title}
        </h3>
        <span className="mt-auto text-xs text-muted-foreground">{timeAgo(chapter.date)}</span>
      </div>
    </Link>
  )
}
