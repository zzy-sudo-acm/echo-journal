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
  overlayStack.push({ id, close })
  return {
    unregister: () => {
      const index = overlayStack.findIndex((overlay) => overlay.id === id)
      if (index >= 0) overlayStack.splice(index, 1)
    },
    isTop: () => overlayStack[overlayStack.length - 1]?.id === id,
  }
}

/** Close the topmost overlay. Returns true if one was open. */
export function closeTopOverlay(): boolean {
  // Pop first: the closer re-renders asynchronously, and without popping a
  // rapid second back press would close the same overlay twice.
  const top = overlayStack.pop()
  if (!top) return false
  top.close()
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
