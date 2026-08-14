import { describe, expect, it, vi } from 'vitest'
import {
  closeTopOverlay,
  overlayDepth,
  registerOverlay,
} from '../utils/backHandler'

/**
 * Hardware back presses arrive as separate events (separate JS tasks), so
 * every test that matters awaits a real task boundary instead of calling
 * closeTopOverlay twice inside one synchronous stack.
 */
async function nextBackPress() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('backHandler overlay stack', () => {
  it('closes overlays in LIFO order', async () => {
    const calls: string[] = []
    const first = registerOverlay(() => { calls.push('first') })
    const second = registerOverlay(() => { calls.push('second') })
    const third = registerOverlay(() => { calls.push('third') })

    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third'])

    // A real close unmounts the overlay, which unregisters it.
    third.unregister()
    await nextBackPress()

    expect(closeTopOverlay()).toBe(true)
    expect(calls).toEqual(['third', 'second'])

    second.unregister()
    first.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('does not re-fire close across separate back events while unmount is pending', async () => {
    const closer = vi.fn(() => true)
    const handle = registerOverlay(closer)

    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(1)

    // The overlay has not unmounted yet (no unregister) — later back presses
    // in later tasks are absorbed, not re-fired, and never fall through.
    await nextBackPress()
    expect(closeTopOverlay()).toBe(true)
    await nextBackPress()
    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(1)

    handle.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('unregisters cleanly after a real close: no ghost entries, back falls through', async () => {
    const closer = vi.fn(() => true)
    const handle = registerOverlay(closer)

    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(1)

    handle.unregister()
    await nextBackPress()

    // Nothing remains on the stack — the next back reaches navigation again.
    expect(overlayDepth()).toBe(0)
    expect(closeTopOverlay()).toBe(false)
  })

  it('lets a refused close (returns false) be requested again on the next press', async () => {
    const closer = vi.fn()
      .mockReturnValueOnce(false) // blocked, stays mounted
      .mockReturnValue(true)      // later attempt actually closes
    const handle = registerOverlay(closer)

    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(1)

    await nextBackPress()
    expect(closeTopOverlay()).toBe(true)
    expect(closer).toHaveBeenCalledTimes(2)

    handle.unregister()
    expect(overlayDepth()).toBe(0)
  })

  it('editor blocked → confirm dialog top → dialog dismissed → editor re-closable', async () => {
    // EntryEditor semantics: a close blocked by unsaved changes returns false
    // and opens the confirm dialog, which registers on top.
    const editorClose = vi.fn()
      .mockReturnValueOnce(false) // blocked: unsaved changes
      .mockReturnValue(true)
    const editor = registerOverlay(editorClose)

    // 1. Back: editor close attempted and blocked; editor stays on the stack.
    expect(closeTopOverlay()).toBe(true)
    expect(editorClose).toHaveBeenCalledTimes(1)
    expect(overlayDepth()).toBe(1)
    await nextBackPress()

    // 2. ConfirmDialog finishes mounting and registers as the new top.
    const confirmClose = vi.fn(() => true)
    const confirm = registerOverlay(confirmClose)
    expect(confirm.isTop()).toBe(true)
    expect(editor.isTop()).toBe(false)

    // 3. While the dialog exists, back presses only reach it.
    await nextBackPress()
    expect(closeTopOverlay()).toBe(true)
    expect(confirmClose).toHaveBeenCalledTimes(1)
    expect(editorClose).toHaveBeenCalledTimes(1)

    // 4. Dialog 取消 → unmount → unregister: editor is top again and
    //    immediately responds to the next back press.
    confirm.unregister()
    await nextBackPress()
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
