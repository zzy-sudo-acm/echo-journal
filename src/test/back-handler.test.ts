import { describe, expect, it, vi } from 'vitest'
import {
  closeTopOverlay,
  overlayDepth,
  registerOverlay,
} from '../utils/backHandler'

/** closeTopOverlay releases its in-flight guard on a microtask. */
async function flushClosingGuard() {
  await Promise.resolve()
}

describe('backHandler overlay stack', () => {
  it('closes overlays in LIFO order', async () => {
    const calls: string[] = []
    const first = registerOverlay(() => calls.push('first'))
    const second = registerOverlay(() => calls.push('second'))
    const third = registerOverlay(() => calls.push('third'))

    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third'])

    // A real close unmounts the overlay, which unregisters it.
    third.unregister()
    await flushClosingGuard()

    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third', 'second'])

    second.unregister()
    first.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('swallows a rapid second press while a close is in flight', async () => {
    const closer = vi.fn()
    const handle = registerOverlay(closer)

    expect(closeTopOverlay()).toBe(true)
    // The overlay is still mounted (close in flight) — a fast second back
    // press must not fire close() again nor fall through to app navigation.
    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(1)

    handle.unregister()
    await flushClosingGuard()
    expect(overlayDepth()).toBe(0)
  })

  it('keeps a blocked close on the stack and lets it be requested again', async () => {
    // Editor whose close is blocked by unsaved changes: close() runs but the
    // overlay stays mounted, so no unregister() happens.
    const editorClose = vi.fn()
    const editor = registerOverlay(editorClose)

    expect(closeTopOverlay()).toBe(true)
    expect(editorClose).toHaveBeenCalledTimes(1)
    expect(overlayDepth()).toBe(1)

    await flushClosingGuard()
    expect(closeTopOverlay()).toBe(true)
    expect(editorClose).toHaveBeenCalledTimes(2)
    expect(overlayDepth()).toBe(1)

    editor.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('restores the blocked editor as top after its confirm dialog is dismissed', async () => {
    // The full editor → confirm → cancel → editor flow:
    const editorClose = vi.fn()
    const editor = registerOverlay(editorClose)

    // 1. Back with unsaved changes: editor close is requested but blocked,
    //    and a confirm dialog opens on top.
    expect(closeTopOverlay()).toBe(true)
    expect(editorClose).toHaveBeenCalledTimes(1)
    await flushClosingGuard()

    const confirmClose = vi.fn()
    const confirm = registerOverlay(confirmClose)
    expect(confirm.isTop()).toBe(true)
    expect(editor.isTop()).toBe(false)

    // 2. Back dismisses the confirm (same as tapping 取消): it unmounts.
    expect(closeTopOverlay()).toBe(true)
    expect(confirmClose).toHaveBeenCalledTimes(1)
    confirm.unregister()
    await flushClosingGuard()

    // 3. The editor is top again and back re-triggers its close confirm.
    expect(editor.isTop()).toBe(true)
    expect(closeTopOverlay()).toBe(true)
    expect(editorClose).toHaveBeenCalledTimes(2)

    editor.unregister()
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
    expect(overlayDepth()).toBe(0)
  })

  it('closeTopOverlay returns false when nothing is open', () => {
    expect(overlayDepth()).toBe(0)
    expect(closeTopOverlay()).toBe(false)
  })
})
