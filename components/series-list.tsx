"use client"

import useSWR from "swr"
import Link from "next/link"
import { getAllSeries, type Series } from "@/lib/api"
import { ListSkeleton, ErrorState } from "@/components/states"
import { BookText } from "lucide-react"

export function SeriesList() {
  const { data, error, isLoading, mutate } = useSWR("all-series", () => getAllSeries(100), {
    revalidateOnFocus: false,
  })

  const series: Series[] = data ?? []

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-5 w-1.5 rounded-full bg-primary" />
        <h1 className="text-lg font-bold text-foreground md:text-xl">Daftar Komik</h1>
        {series.length > 0 ? (
          <span className="text-sm text-muted-foreground">({series.length})</span>
        ) : null}
      </div>

      {isLoading ? (
        <ListSkeleton count={14} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/komik/${s.slug}`}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <BookText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-medium text-card-foreground group-hover:text-primary">
                  {s.name}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {s.count} ch
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
