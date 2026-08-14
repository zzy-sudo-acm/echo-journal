import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { registerOverlay } from '../../utils/backHandler'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared overlay lifecycle: back-button registration, Escape to close,
 * focus trap, and focus restoration. Only the topmost overlay responds to
 * keys, so nested overlays (confirm over editor) behave correctly.
 */
function useOverlayLifecycle(onClose: () => boolean | void, containerRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handle = registerOverlay(() => onCloseRef.current())
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const container = containerRef.current
    const initialFocus =
      container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? container ?? null
    initialFocus?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!handle.isTop()) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      handle.unregister()
      previouslyFocused?.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once per mount
  }, [containerRef])
}

interface BaseOverlayProps {
  /** Close request. Return false to refuse (stay mounted); anything else
   *  (including void) means the overlay will unmount. The return drives the
   *  hardware-back closing lifecycle. */
  onClose: () => boolean | void
  children: ReactNode
  /** Classes on the dimmed backdrop element. */
  overlayClassName: string
  /** Classes on the panel element. */
  panelClassName: string
  /** Close when the dimmed backdrop is tapped. Default true. */
  closeOnOverlayClick?: boolean
  /** ARIA role for the panel. Default "dialog". */
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
}

/** Portal-rendered overlay with the full lifecycle, styling left to the caller. */
export function OverlayBase({
  onClose,
  children,
  overlayClassName,
  panelClassName,
  closeOnOverlayClick = true,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
}: BaseOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlayLifecycle(onClose, panelRef)

  return createPortal(
    <div className={overlayClassName} onClick={closeOnOverlayClick ? onClose : undefined}>
      <div
        ref={panelRef}
        className={panelClassName}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

interface OverlayProps {
  /** Close request. Return false to refuse (stay mounted); anything else
   *  (including void) means the overlay will unmount. */
  onClose: () => boolean | void
  children: ReactNode
  /** Extra class on the panel element. */
  className?: string
  /** Close when the dimmed backdrop is tapped. Default true. */
  closeOnOverlayClick?: boolean
  /** ARIA role for the panel. Default "dialog". */
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
}

/**
 * Bottom sheet on mobile, centered dialog on desktop — the one overlay
 * primitive for the whole app. Styling comes from the existing
 * `.modal-overlay` / `.modal` design-system classes.
 */
export function Sheet({ onClose, children, className = '', ...rest }: OverlayProps) {
  return (
    <OverlayBase
      onClose={onClose}
      overlayClassName="modal-overlay"
      panelClassName={`modal ${className}`.trim()}
      {...rest}
    >
      {children}
    </OverlayBase>
  )
}

/** Centered alert-style dialog (same primitive, centered on every screen). */
export function Dialog({ onClose, children, className = '', ...rest }: OverlayProps) {
  return (
    <OverlayBase
      onClose={onClose}
      overlayClassName="confirm-overlay"
      panelClassName={`confirm-box ${className}`.trim()}
      {...rest}
    >
      {children}
    </OverlayBase>
  )
}
