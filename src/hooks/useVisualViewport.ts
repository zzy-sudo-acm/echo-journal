import { useEffect, useRef } from 'react'

export interface ViewportSnapshot {
  height: number
  top: number
}

/**
 * Subscribe to visualViewport resize/scroll (soft keyboard, orientation)
 * with a window fallback. The handler receives the latest snapshot and runs
 * once immediately on mount.
 */
export function useVisualViewport(handler: (snapshot: ViewportSnapshot) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () =>
      handlerRef.current({
        height: viewport?.height ?? window.innerHeight,
        top: viewport?.offsetTop ?? 0,
      })

    update()
    const resizeTarget: EventTarget = viewport ?? window
    resizeTarget.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
    return () => {
      resizeTarget.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
}
