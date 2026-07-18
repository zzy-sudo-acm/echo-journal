import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  action: () => void | Promise<void>
}

export interface ToastContextType {
  showToast: (text: string, type?: 'success' | 'error' | 'info', undoAction?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}