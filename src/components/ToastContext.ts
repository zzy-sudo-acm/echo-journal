import { createContext, useContext } from 'react'

export interface ToastContextType {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

export const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
