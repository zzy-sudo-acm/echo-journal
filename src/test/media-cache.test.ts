import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { mediaRepo } from '../db/repository'
import {
  acquireMediaUrl,
  clearMediaUrlCache,
  invalidateMediaUrl,
} from '../services/mediaCache'

let urlCounter = 0

function nextUrl() {
  urlCounter += 1
  return `blob:test-${urlCounter}`
}

async function seedMedia(id?: string) {
  return mediaRepo.create({
    ...(id ? { id } : {}),
    blob: new Blob(['fake-image'], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 100,
    height: 80,
  })
}

describe('mediaCache', () => {
  beforeEach(async () => {
    await db.media.clear()
    clearMediaUrlCache()
    // Clear mock history AFTER cache teardown so teardown revokes don't leak
    // into this test's assertions.
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(nextUrl)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('shares one object URL across concurrent acquirers', async () => {
    const media = await seedMedia()

    const first = acquireMediaUrl(media.id)
    const second = acquireMediaUrl(media.id)
    const [firstResult, secondResult] = await Promise.all([first.promise, second.promise])

    expect(firstResult).not.toBeNull()
    expect(secondResult!.url).toBe(firstResult!.url)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)

    first.release()
    second.release()
  })

  it('serves repeat acquires from cache after full release', async () => {
    const media = await seedMedia()

    const first = acquireMediaUrl(media.id)
    const firstUrl = (await first.promise)!.url
    first.release()

    const second = acquireMediaUrl(media.id)
    expect((await second.promise)!.url).toBe(firstUrl)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    second.release()
  })

  it('returns null for missing media without throwing', async () => {
    const acquisition = acquireMediaUrl('missing-id')
    expect(await acquisition.promise).toBeNull()
    acquisition.release()
  })

  it('rebuilds the URL after an idle invalidation', async () => {
    const media = await seedMedia()

    const first = acquireMediaUrl(media.id)
    const firstUrl = (await first.promise)!.url
    first.release()

    invalidateMediaUrl(media.id)

    const second = acquireMediaUrl(media.id)
    const secondUrl = (await second.promise)!.url
    expect(secondUrl).not.toBe(firstUrl)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl)
    second.release()
  })

  it('keeps the old URL alive for active holders during invalidation', async () => {
    const media = await seedMedia()

    const held = acquireMediaUrl(media.id)
    const heldUrl = (await held.promise)!.url

    invalidateMediaUrl(media.id)
    // Old URL not revoked while still referenced.
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(heldUrl)

    const fresh = acquireMediaUrl(media.id)
    const freshUrl = (await fresh.promise)!.url
    expect(freshUrl).not.toBe(heldUrl)

    held.release()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(heldUrl)
    // The fresh entry must stay alive after the old one drains.
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(freshUrl)
    fresh.release()
  })

  it('evicts least-recently-used idle entries beyond the cap', async () => {
    const medias = await Promise.all(Array.from({ length: 61 }, () => seedMedia()))

    let oldestUrl: string | null = null
    for (const [index, media] of medias.entries()) {
      const acquisition = acquireMediaUrl(media.id)
      const url = (await acquisition.promise)!.url
      if (index === 0) oldestUrl = url
      acquisition.release()
    }

    // The first entry should have been evicted once the cache overflowed.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(oldestUrl)

    const reacquired = acquireMediaUrl(medias[0].id)
    const newUrl = (await reacquired.promise)!.url
    expect(newUrl).not.toBe(oldestUrl)
    reacquired.release()
  })
})
