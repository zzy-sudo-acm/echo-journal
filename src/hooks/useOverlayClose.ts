import { useEffect, useRef } from 'react'
import { registerOverlay } from '../utils/backHandler'

/**
 * Minimal close wiring for page-like overlays (e.g. the full-screen editor):
 * hardware-back/Escape trigger onClose while this overlay is topmost.
 * No focus trap — the component keeps managing its own focus.
 */
export function useOverlayClose(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handle = registerOverlay(() => onCloseRef.current())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!handle.isTop()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      handle.unregister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once per mount
  }, [])
}
