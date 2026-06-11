"use client"

import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { searchChapters, type Chapter } from "@/lib/api"
import { ChapterCard } from "@/components/chapter-card"
import { CardGridSkeleton, ErrorState } from "@/components/states"
import { SearchX } from "lucide-react"

export function SearchResults() {
  const params = useSearchParams()
  const query = params.get("q") ?? ""

  const { data, error, isLoading, mutate } = useSWR(
    query ? ["search", query] : null,
    () => searchChapters(query, 24),
    { revalidateOnFocus: false },
  )

  const results: Chapter[] = data ?? []

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-5 w-1.5 rounded-full bg-primary" />
        <h1 className="text-lg font-bold text-foreground md:text-xl">
          Hasil pencarian: <span className="text-primary">{query}</span>
        </h1>
      </div>

      {!query ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Masukkan kata kunci untuk mencari komik.
        </p>
      ) : isLoading ? (
        <CardGridSkeleton count={12} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-10 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Tidak ada hasil untuk &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((c) => (
            <ChapterCard key={c.id} chapter={c} />
          ))}
        </div>
      )}
    </section>
  )
}
