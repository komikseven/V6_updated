import { redirect } from "next/navigation"

const API_BASE = "https://komik7.my.id/wp-json/wp/v2"

async function getSlugById(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // cache 1 day
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.slug ?? null
  } catch {
    return null
  }
}

export default async function SeriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const slug = await getSlugById(id)
  if (slug) {
    redirect(`/komik/${slug}`)
  }
  // Fallback: slug not found, go to series list
  redirect("/series")
}
