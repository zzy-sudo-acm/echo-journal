import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Android back-button orchestration.
 *
 * Overlays (sheets, dialogs, the editor) register a closer as they mount;
 * the hardware back button always closes the most recently registered one
 * first. When nothing is open, back collapses the keyboard, then walks
 * back to the timeline tab, and finally backgrounds the app.
 */

interface OverlayRegistration {
  id: symbol
  close: () => void
  /** True while a close request is in flight — bridges the gap between
   *  close() and the eventual unregister() so a rapid second back press
   *  cannot fire the same overlay's close twice. */
  closing: boolean
}

const overlayStack: OverlayRegistration[] = []

export interface OverlayHandle {
  /** Remove this overlay from the stack. */
  unregister: () => void
  /** True when this overlay is the most recently registered (topmost) one. */
  isTop: () => boolean
}

/** Register an overlay closer; returns a handle with unregister + isTop. */
export function registerOverlay(close: () => void): OverlayHandle {
  const id = Symbol('overlay')
  overlayStack.push({ id, close, closing: false })
  return {
    unregister: () => {
      const index = overlayStack.findIndex((overlay) => overlay.id === id)
      if (index >= 0) overlayStack.splice(index, 1)
    },
    isTop: () => overlayStack[overlayStack.length - 1]?.id === id,
  }
}

/**
 * Close the topmost overlay. Returns true if one is open (including a close
 * already in flight, which is swallowed so back does not fall through).
 *
 * The entry STAYS on the stack until the overlay actually unmounts and calls
 * unregister(): a close can be blocked (e.g. the editor's unsaved-changes
 * confirm), and popping early would leave the still-visible overlay
 * unreachable by the back button. The `closing` flag alone guards against
 * double-firing and is released on the next microtask — by then a real
 * unmount has unregistered the entry, and a blocked close is ready to be
 * requested again.
 */
export function closeTopOverlay(): boolean {
  const top = overlayStack[overlayStack.length - 1]
  if (!top) return false
  if (top.closing) return true
  top.closing = true
  top.close()
  queueMicrotask(() => {
    top.closing = false
  })
  return true
}

/** Depth is exported for tests and diagnostics. */
export function overlayDepth(): number {
  return overlayStack.length
}

function blurActiveInput(): boolean {
  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)
  ) {
    active.blur()
    return true
  }
  return false
}

/**
 * Wire the hardware back button. No-op off native platforms, where browser
 * history navigation already does the right thing.
 */
export function initBackHandler(options: {
  navigateHome: () => void
  isHome: () => boolean
}): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const listener = App.addListener('backButton', () => {
    if (closeTopOverlay()) return
    if (blurActiveInput()) return
    if (!options.isHome()) {
      options.navigateHome()
      return
    }
    void App.minimizeApp()
  })

  return () => {
    void listener.then((handle) => handle.remove())
  }
}
