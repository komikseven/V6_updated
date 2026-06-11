import { NextResponse } from "next/server"
import { getGenres } from "@/lib/api"
import { cached, TTL } from "@/lib/redis"

export const runtime = "nodejs"
export const revalidate = 0

export async function GET() {
  try {
    const genres = await cached("komiku:genres", TTL.genres, () => getGenres())
    return NextResponse.json(genres)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
