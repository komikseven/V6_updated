/**
 * Redis cache layer untuk KOMIKU
 *
 * Pola: Next.js → Redis (cache) → WordPress API
 * Jika Redis kosong / error, langsung fetch ke WordPress.
 *
 * Setup:
 *  1. Install:  pnpm add ioredis
 *  2. .env.local: REDIS_URL=redis://localhost:6379
 *     (Upstash pakai: REDIS_URL=rediss://user:pass@host:port)
 */

import type { Redis as IORedis } from "ioredis"

// TTL defaults (detik)
export const TTL = {
  genres:    3600 * 6,  // 6 jam
  series:    3600 * 2,  // 2 jam
  chapters:  60 * 10,   // 10 menit
  home:      60 * 5,    // 5 menit
  seriesDetail: 3600,   // 1 jam
} as const

let _client: IORedis | null = null

function getClient(): IORedis | null {
  if (typeof window !== "undefined") return null          // client-side, skip
  if (!process.env.REDIS_URL) return null                 // tidak dikonfigurasi

  if (_client) return _client

  try {
    // Dynamic import supaya tidak error di build jika package belum install
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis")
    _client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    }) as IORedis
    _client.on("error", () => {
      // Diam saja, fallback ke WP langsung
    })
    return _client
  } catch {
    return null
  }
}

/**
 * Ambil dari cache Redis.
 * Return null jika miss, Redis tidak tersedia, atau error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getClient()
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Simpan ke cache Redis dengan TTL (detik).
 */
export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
  const redis = getClient()
  if (!redis) return
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/**
 * Hapus cache key tertentu (misal setelah update).
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getClient()
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    // ignore
  }
}

/**
 * Helper: cache-aside pattern.
 * Coba Redis → kalau miss, jalankan fetcher → simpan ke Redis → return.
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key)
  if (hit !== null) return hit

  const data = await fetcher()
  await cacheSet(key, data, ttl)
  return data
}
