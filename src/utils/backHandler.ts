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
  /** Closes the overlay. Returns false when the close was refused/blocked
   *  (the overlay stays mounted); true or void means unmount is pending. */
  close: () => boolean | void
  /** True from a confirmed close request until unregister(). Absorbs any
   *  number of back presses during the async unmount window. */
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
export function registerOverlay(close: () => boolean | void): OverlayHandle {
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
 * Close the topmost overlay. Returns true whenever an overlay is open
 * (including a close already in flight), so back never falls through to
 * keyboard/navigation/minimize while anything is displayed.
 *
 * The `closing` lifecycle is event-driven, never time-based:
 *  - armed only when close() reports a real close (returns true/void);
 *  - released only by unregister() when the overlay actually unmounts —
 *    the stack entry is removed with it, leaving no ghost state;
 *  - a refused/blocked close (returns false, e.g. the editor's
 *    unsaved-changes confirm or a busy dialog) never arms it, so the
 *    still-visible overlay stays on the stack and immediately re-closable.
 */
export function closeTopOverlay(): boolean {
  const top = overlayStack[overlayStack.length - 1]
  if (!top) return false
  if (top.closing) return true
  top.closing = top.close() !== false
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
