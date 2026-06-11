import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SeriesList } from "@/components/series-list"

export default function SeriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <SeriesList />
      </main>
      <SiteFooter />
    </div>
  )
}
