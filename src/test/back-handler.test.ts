import { describe, expect, it, vi } from 'vitest'
import {
  closeTopOverlay,
  overlayDepth,
  registerOverlay,
} from '../utils/backHandler'

describe('backHandler overlay stack', () => {
  it('closes overlays in LIFO order', () => {
    const calls: string[] = []
    const first = registerOverlay(() => calls.push('first'))
    const second = registerOverlay(() => calls.push('second'))
    const third = registerOverlay(() => calls.push('third'))

    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third'])
    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third', 'second'])

    // Popped entries unregister as no-ops later (async unmount path).
    third.unregister()
    second.unregister()
    expect(overlayDepth()).toBe(1)
    first.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('unregister removes the overlay without closing it', () => {
    const closer = vi.fn()
    const handle = registerOverlay(closer)
    handle.unregister()

    expect(closeTopOverlay()).toBe(false)
    expect(closer).not.toHaveBeenCalled()
  })

  it('isTop only holds for the most recent registration', () => {
    const first = registerOverlay(() => {})
    const second = registerOverlay(() => {})

    expect(first.isTop()).toBe(false)
    expect(second.isTop()).toBe(true)

    second.unregister()
    expect(first.isTop()).toBe(true)
    first.unregister()
  })

  it('closeTopOverlay returns false when nothing is open', () => {
    expect(overlayDepth()).toBe(0)
    expect(closeTopOverlay()).toBe(false)
  })
})
