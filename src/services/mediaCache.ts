import { mediaRepo } from '../db/repository'
import { LOCAL_MEDIA_UPDATED_EVENT } from '../utils/events'

/**
 * Cross-component objectURL cache for journal media.
 *
 * Every rendered card used to read IndexedDB and mint its own object URLs,
 * so scrolling a long timeline multiplied IO and memory. This cache shares
 * one URL per media id, reference-counted, with LRU eviction for idle
 * entries. Compression updates broadcast LOCAL_MEDIA_UPDATED_EVENT, which
 * invalidates the affected entry.
 */

export interface CachedMediaUrl {
  url: string
  width: number
  height: number
}

export interface MediaAcquisition {
  promise: Promise<CachedMediaUrl | null>
  /** Idempotent; call exactly when the consumer stops displaying the URL. */
  release: () => void
}

interface CacheEntry {
  promise: Promise<CachedMediaUrl | null>
  url: string | null
  refs: number
  /** Invalidated while still displayed: drop from the map, revoke once refs drain. */
  detached: boolean
}

const MAX_CACHED_URLS = 60
const cache = new Map<string, CacheEntry>()

function revoke(entry: CacheEntry) {
  if (entry.url) {
    URL.revokeObjectURL(entry.url)
    entry.url = null
  }
}

/** Evict idle entries beyond the cap. Map order doubles as LRU order. */
function evictIdle() {
  if (cache.size <= MAX_CACHED_URLS) return
  for (const [id, entry] of cache) {
    if (cache.size <= MAX_CACHED_URLS) break
    if (entry.refs === 0) {
      revoke(entry)
      cache.delete(id)
    }
  }
}

export function acquireMediaUrl(mediaId: string): MediaAcquisition {
  const existing = cache.get(mediaId)
  if (existing) {
    existing.refs += 1
    cache.delete(mediaId)
    cache.set(mediaId, existing) // refresh LRU position
    let released = false
    return {
      promise: existing.promise,
      release: () => {
        if (released) return
        released = true
        releaseEntry(existing)
      },
    }
  }

  const entry: CacheEntry = {
    promise: Promise.resolve(null),
    url: null,
    refs: 1,
    detached: false,
  }
  entry.promise = mediaRepo
    .get(mediaId)
    .then((media) => {
      if (!media?.blob) return null
      try {
        const url = URL.createObjectURL(media.blob)
        entry.url = url
        return { url, width: media.width, height: media.height }
      } catch {
        return null
      }
    })
    .catch(() => null)

  cache.set(mediaId, entry)
  evictIdle()

  let released = false
  return {
    promise: entry.promise,
    release: () => {
      if (released) return
      released = true
      releaseEntry(entry)
    },
  }
}

function releaseEntry(entry: CacheEntry) {
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs > 0) return
  if (entry.detached) {
    revoke(entry)
    return
  }
  evictIdle()
}

/** Drop the cached URL for a media id; active holders keep working until released. */
export function invalidateMediaUrl(mediaId: string): void {
  const entry = cache.get(mediaId)
  if (!entry) return
  cache.delete(mediaId)
  entry.detached = true
  if (entry.refs === 0) revoke(entry)
}

/** Drop every cached URL — test teardown and full resets. */
export function clearMediaUrlCache(): void {
  for (const entry of cache.values()) revoke(entry)
  cache.clear()
}

// Image compression swaps the blob under an existing media id.
if (typeof window !== 'undefined') {
  window.addEventListener(LOCAL_MEDIA_UPDATED_EVENT, (event) => {
    const mediaId = (event as CustomEvent<unknown>).detail
    if (typeof mediaId === 'string' && mediaId) invalidateMediaUrl(mediaId)
  })
}
