export const API_BASE = "https://komik7.my.id/wp-json/wp/v2"

export interface Series {
  id: number
  name: string
  slug: string
  count: number
  description?: string
  thumbnail?: string
  genres?: Genre[]
}

export interface Chapter {
  id: number
  title: string
  link: string
  date: string
  chapterNumber: string
  seriesTitle: string
  seriesId: number
  categories: number[]
  categoryId: number
  contentHtml: string
  thumbnail: string
  images: string[]
}

export interface MenuItem {
  id: number
  title: string
  url: string
}

function decodeHtml(text: string): string {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&nbsp;/g, " ")
}

export function extractImages(contentRendered: string): string[] {
  const regex = /<img[^>]+src="([^">]+)"/gi
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(contentRendered || "")) !== null) {
    out.push(m[1])
  }
  return out
}

// Route manga images through our proxy to bypass hotlink/referer protection.
export function proxyImage(src: string): string {
  if (!src || src.startsWith("/")) return src || "/manga-placeholder.png"
  return `/api/img?url=${encodeURIComponent(src)}`
}

// Resolve a cover from a category description: plain URL, <img> tag, or fallback.
export function parseCover(description: string): string {
  const desc = (description || "").trim()
  if (!desc) return "/manga-placeholder.png"
  if (desc.startsWith("http")) return desc.split(/\s+/)[0]
  const imgs = extractImages(desc)
  return imgs.length > 0 ? imgs[0] : "/manga-placeholder.png"
}

export function getThumbnail(contentRendered: string): string {
  const imgs = extractImages(contentRendered)
  return imgs.length > 0 ? imgs[0] : "/manga-placeholder.png"
}

interface RawPost {
  id: number
  title?: { rendered?: string }
  link?: string
  date?: string
  meta?: Record<string, unknown>
  categories?: number[]
  content?: { rendered?: string }
}

interface RawCategory {
  id: number
  name: string
  slug: string
  count: number
  description?: string
}

export function parseChapter(raw: RawPost): Chapter {
  const meta = (raw.meta ?? {}) as Record<string, unknown>
  const cats = raw.categories ?? []
  const content = raw.content?.rendered ?? ""
  const images = extractImages(content)
  return {
    id: raw.id,
    title: decodeHtml(raw.title?.rendered ?? ""),
    link: raw.link ?? "",
    date: raw.date ?? "",
    chapterNumber: String(meta["ero_chapter"] ?? meta["chapter_number"] ?? "").trim(),
    seriesTitle: decodeHtml(String(meta["ero_chapter_title"] ?? "")),
    seriesId: Number.parseInt(String(meta["ero_seri"] ?? "0"), 10) || 0,
    categories: cats,
    categoryId: cats.length > 0 ? cats[0] : 0,
    contentHtml: content,
    thumbnail: images.length > 0 ? images[0] : "/manga-placeholder.png",
    images,
  }
}

export function parseSeries(raw: RawCategory): Series {
  const desc = raw.description ?? ""
  const cover = parseCover(desc)
  // Sinopsis: strip the cover URL/img from description, then strip all HTML
  let sinopsis = desc
  if (sinopsis.startsWith("http")) {
    // first word is the URL, rest might be description
    sinopsis = sinopsis.replace(/^https?:\/\/\S+\s*/, "")
  }
  sinopsis = decodeHtml(sinopsis.replace(/<[^>]+>/g, "").trim())

  return {
    id: raw.id,
    name: decodeHtml((raw.name ?? "").replace(/^Komik\s+/i, "")),
    slug: raw.slug ?? "",
    count: raw.count ?? 0,
    description: sinopsis || undefined,
    thumbnail: cover !== "/manga-placeholder.png" ? cover : undefined,
  }
}

const POST_FIELDS = "id,title,link,date,meta,categories,content"

async function fetchJson(url: string): Promise<{ data: unknown; res: Response }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const data = await res.json()
  return { data, res }
}

export const fetcher = async (url: string) => {
  const { data } = await fetchJson(url)
  return data
}

// Dynamic navigation menu from WordPress (falls back to hardcoded nav on failure).
export async function getMenuItems(): Promise<MenuItem[]> {
  try {
    const menusRes = await fetch(`${API_BASE}/menus`, { headers: { Accept: "application/json" } })
    if (!menusRes.ok) return []
    const menus = (await menusRes.json()) as Array<{ id: number }>
    if (!Array.isArray(menus) || !menus.length) return []
    const menuId = menus[0].id
    const itemsRes = await fetch(`${API_BASE}/menu-items?menus=${menuId}`, {
      headers: { Accept: "application/json" },
    })
    if (!itemsRes.ok) return []
    const items = (await itemsRes.json()) as Array<{ id: number; title?: { rendered?: string }; url?: string }>
    return items.map((it) => ({
      id: it.id,
      title: decodeHtml(it.title?.rendered ?? ""),
      url: it.url ?? "#",
    }))
  } catch {
    return []
  }
}

// Latest chapters (homepage / post page)
export async function getLatestChapters(page = 1, perPage = 24) {
  const url = `${API_BASE}/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=${POST_FIELDS}`
  const { data, res } = await fetchJson(url)
  const totalPages = Number.parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10) || 1
  const chapters = (data as RawPost[]).map(parseChapter)
  return { chapters, totalPages }
}

// All series (categories)
export async function getAllSeries(perPage = 100, page = 1) {
  const url = `${API_BASE}/categories?per_page=${perPage}&page=${page}&orderby=count&order=desc&hide_empty=true&exclude=1`
  const data = await fetcher(url)
  return (data as RawCategory[]).map(parseSeries)
}

// Resolve a thumbnail for a series by reading its most recent chapter post.
export async function getSeriesThumbnail(categoryId: number): Promise<string> {
  try {
    const url = `${API_BASE}/posts?categories=${categoryId}&per_page=1&orderby=date&order=desc&_fields=content`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) return "/manga-placeholder.png"
    const posts = (await res.json()) as RawPost[]
    if (!posts.length) return "/manga-placeholder.png"
    return getThumbnail(posts[0].content?.rendered ?? "")
  } catch {
    return "/manga-placeholder.png"
  }
}

// Paginated series list (homepage). Thumbnails are resolved lazily per card.
export async function getSeriesPage(page = 1, perPage = 24) {
  const url = `${API_BASE}/categories?per_page=${perPage}&page=${page}&orderby=count&order=desc&hide_empty=true&exclude=1`
  const { data, res } = await fetchJson(url)
  const totalPages = Number.parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10) || 1
  const series = (data as RawCategory[]).map(parseSeries)
  return { series, totalPages }
}

// Single series detail
export async function getSeries(id: number) {
  const url = `${API_BASE}/categories/${id}`
  const data = await fetcher(url)
  return parseSeries(data as RawCategory)
}

// Chapters by series/category
export async function getChaptersByCategory(categoryId: number, perPage = 100, page = 1) {
  const url = `${API_BASE}/posts?categories=${categoryId}&per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=${POST_FIELDS}`
  const data = await fetcher(url)
  return (data as RawPost[]).map(parseChapter)
}

// Single chapter (reader)
export async function getChapter(id: number) {
  const url = `${API_BASE}/posts/${id}?_fields=${POST_FIELDS}`
  const data = await fetcher(url)
  return parseChapter(data as RawPost)
}

// Search chapters/posts
export async function searchChapters(query: string, perPage = 24) {
  const url = `${API_BASE}/posts?search=${encodeURIComponent(query)}&per_page=${perPage}&_fields=${POST_FIELDS}`
  const data = await fetcher(url)
  return (data as RawPost[]).map(parseChapter)
}

// Search series/categories
export async function searchSeries(query: string, perPage = 24) {
  const url = `${API_BASE}/categories?search=${encodeURIComponent(query)}&per_page=${perPage}&exclude=1`
  const data = await fetcher(url)
  return (data as RawCategory[]).map(parseSeries)
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ""
  if (seconds < 60) return "baru saja"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} bulan lalu`
  const years = Math.floor(months / 12)
  return `${years} tahun lalu`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

// Single series by slug
export async function getSeriesBySlug(slug: string) {
  const url = `${API_BASE}/categories?slug=${encodeURIComponent(slug)}&per_page=1`
  const data = await fetcher(url)
  const arr = data as RawCategory[]
  if (!arr.length) throw new Error(`Series "${slug}" tidak ditemukan`)
  return parseSeries(arr[0])
}

// ─── Custom komik7 API ───────────────────────────────────────────────────────

export const KOMIK7_BASE = "https://komik7.my.id/wp-json/komik7/v1"

export interface Genre {
  id: number
  name: string
  slug: string
  count: number
}

export interface MangaType {
  slug: "manga" | "manhwa" | "manhua"
  label: string
  emoji: string
  description: string
}

export const MANGA_TYPES: MangaType[] = [
  { slug: "manga",   label: "Manga",   emoji: "🇯🇵", description: "Komik dari Jepang" },
  { slug: "manhwa",  label: "Manhwa",  emoji: "🇰🇷", description: "Komik dari Korea" },
  { slug: "manhua",  label: "Manhua",  emoji: "🇨🇳", description: "Komik dari China" },
]

export async function getGenres(): Promise<Genre[]> {
  try {
    const res = await fetch(`${KOMIK7_BASE}/genres`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error("genres fetch failed")
    const data = await res.json()
    // handle both array and object response
    if (Array.isArray(data)) return data as Genre[]
    if (data && Array.isArray(data.genres)) return data.genres as Genre[]
    return []
  } catch {
    // fallback ke wp/v2/tags kalau custom endpoint gagal
    try {
      const res = await fetch(
        `${API_BASE}/tags?per_page=100&orderby=count&order=desc&hide_empty=true`,
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) return []
      const tags = await res.json() as Array<{ id: number; name: string; slug: string; count: number }>
      return tags.map(t => ({ id: t.id, name: decodeHtml(t.name), slug: t.slug, count: t.count }))
    } catch {
      return []
    }
  }
}

export async function getSeriesByType(type: string, page = 1, perPage = 24) {
  // filter categories by slug yang mengandung type
  const url = `${API_BASE}/categories?per_page=${perPage}&page=${page}&orderby=count&order=desc&hide_empty=true&exclude=1&search=${type}`
  const { data, res } = await fetchJson(url)
  const totalPages = Number.parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10) || 1
  const series = (data as RawCategory[]).map(parseSeries)
  return { series, totalPages }
}

// Fetch genre tags for a specific post (to get series genres)
export async function getSeriesGenres(categoryId: number): Promise<Genre[]> {
  try {
    // Get most recent post in this category, then fetch its tags
    const postsUrl = `${API_BASE}/posts?categories=${categoryId}&per_page=1&orderby=date&order=desc&_fields=id,tags`
    const postsRes = await fetch(postsUrl, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } })
    if (!postsRes.ok) return []
    const posts = await postsRes.json() as Array<{ id: number; tags?: number[] }>
    if (!posts.length || !posts[0].tags?.length) return []

    const tagIds = posts[0].tags!.slice(0, 10).join(",")
    const tagsUrl = `${API_BASE}/tags?include=${tagIds}&per_page=10`
    const tagsRes = await fetch(tagsUrl, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } })
    if (!tagsRes.ok) return []
    const tags = await tagsRes.json() as Array<{ id: number; name: string; slug: string; count: number }>
    return tags.map(t => ({ id: t.id, name: decodeHtml(t.name), slug: t.slug, count: t.count }))
  } catch {
    return []
  }
}

