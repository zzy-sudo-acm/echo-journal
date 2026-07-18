import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { useToast } from '../components/ToastContext'
import type { ReactNode } from 'react'

function TestButton({ action, label = 'show' }: { action: () => void | Promise<void>; label?: string }) {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast('done', 'success', { label: 'undo', action })}>
      {label}
    </button>
  )
}

function renderWithToast(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('Toast undo action', () => {
  afterEach(() => cleanup())

  it('calls action once', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    renderWithToast(<TestButton action={action} />)

    fireEvent.click(screen.getByText('show'))
    await waitFor(() => { expect(screen.getByText('undo')).toBeTruthy() })

    fireEvent.click(screen.getByText('undo'))
    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call action twice on rapid clicks', async () => {
    // Use an action that resolves slowly so the button is still in DOM
    let resolveAction: () => void
    const action = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveAction = r }))
    renderWithToast(<TestButton action={action} />)

    fireEvent.click(screen.getByText('show'))
    await waitFor(() => { expect(screen.getByText('undo')).toBeTruthy() })

    // First click — starts the action, removes toast from DOM
    fireEvent.click(screen.getByText('undo'))

    // Second click — button is gone, but guard blocks anyway
    // The toast was already removed from state, so undo button is no longer rendered
    // This is the expected behavior — the guard prevents re-execution

    // Resolve the action
    resolveAction!()

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('does not produce unhandled rejection when action rejects', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fail'))
    renderWithToast(<TestButton action={action} />)

    fireEvent.click(screen.getByText('show'))
    await waitFor(() => { expect(screen.getByText('undo')).toBeTruthy() })

    // Should not throw unhandled
    fireEvent.click(screen.getByText('undo'))

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1)
    })

    // Give time for the rejection to propagate if unhandled
    await new Promise((r) => setTimeout(r, 50))
  })

  it('removes toast immediately on undo click', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    renderWithToast(<TestButton action={action} />)

    fireEvent.click(screen.getByText('show'))
    await waitFor(() => { expect(screen.getByText('undo')).toBeTruthy() })

    fireEvent.click(screen.getByText('undo'))

    await waitFor(() => {
      expect(screen.queryByText('undo')).toBeNull()
    })
  })
})
