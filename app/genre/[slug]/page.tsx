"use client"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SeriesCard } from "@/components/series-card"
import { MANGA_TYPES, API_BASE, parseSeries, type Series } from "@/lib/api"
import { use, useState, useCallback } from "react"
import useSWR from "swr"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface RawCategory {
  id: number
  name: string
  slug: string
  count: number
  description?: string
}

async function fetchBySlug(slug: string, page: number): Promise<{ series: Series[]; totalPages: number }> {
  const isType = MANGA_TYPES.some(t => t.slug === slug)

  // Kalau tipe (manga/manhwa/manhua), filter berdasarkan nama kategori mengandung type
  const searchParam = isType ? `&search=${slug}` : `&slug=${encodeURIComponent(slug)}`
  const url = `${API_BASE}/categories?per_page=24&page=${page}&orderby=count&order=desc&hide_empty=true&exclude=1${searchParam}`

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const totalPages = Number.parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10) || 1
  const data = await res.json() as RawCategory[]
  return { series: data.map(parseSeries), totalPages }
}

export default function GenreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [page, setPage] = useState(1)

  const typeInfo = MANGA_TYPES.find(t => t.slug === slug)

  const { data, isLoading } = useSWR(
    ["genre-detail", slug, page],
    () => fetchBySlug(slug, page),
    { revalidateOnFocus: false }
  )

  const label = typeInfo
    ? `${typeInfo.emoji} ${typeInfo.label}`
    : slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ")

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:pb-6">

        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2">
          <Link href="/genre" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Jelajahi
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>

        <h1 className="mb-6 text-xl font-bold text-foreground">{label}</h1>

        {/* Grid */}
        {isLoading && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton aspect-[2/3] rounded-xl" />
                <div className="skeleton h-4 w-3/4 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && data && data.series.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {data.series.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                >
                  ← Sebelumnya
                </button>
                <span className="text-sm text-muted-foreground">
                  {page} / {data.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                >
                  Berikutnya →
                </button>
              </div>
            )}
          </>
        )}

        {!isLoading && (!data || data.series.length === 0) && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📭</p>
            <p>Tidak ada komik ditemukan untuk genre ini.</p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
