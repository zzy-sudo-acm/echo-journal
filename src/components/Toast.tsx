import { useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { ToastContext, type ToastAction } from './ToastContext'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
  undoAction?: ToastAction
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info', undoAction?: ToastAction) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, text, type, undoAction }])
      const timer = setTimeout(() => {
        timers.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, undoAction ? 5000 : 3000)
      timers.current.set(id, timer)
    },
    [],
  )

  const handleUndo = (toast: ToastMessage) => {
    const timer = timers.current.get(toast.id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(toast.id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    if (toast.undoAction) {
      void toast.undoAction.action()
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'calc(100vw - 32px)' }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : t.type === 'success' ? 'toast-success' : ''}`}>
            <span>{t.text}</span>
            {t.undoAction ? (
              <button type="button" className="toast-undo" onClick={() => handleUndo(t)}>
                {t.undoAction.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}