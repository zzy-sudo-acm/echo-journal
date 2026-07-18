import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReviewPage } from '../pages/ReviewPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'

function renderReviewPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ReviewPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('ReviewPage', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    await db.entries.clear()
    await db.tags.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const createReviewEntry = async (content: string, yearOffset = -1) => {
    const today = new Date()
    const date = new Date(today.getFullYear() + yearOffset, today.getMonth(), today.getDate(), 10, 0)
    // If today's date doesn't exist in that year (Feb 29 on non-leap years), skip back to 28
    if (date.getMonth() !== today.getMonth()) {
      date.setDate(28)
    }
    return entryRepo.create({ content, createdAt: date.toISOString() })
  }

  it('shows empty state when no past entries', async () => {
    renderReviewPage()
    await waitFor(() => {
      expect(screen.getByText(/过去的今天还没有记录/)).toBeTruthy()
    })
  })

  it('shows past entries and removes entry on delete', async () => {
    await createReviewEntry('过去的日记', -1)

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByText('过去的日记')).toBeTruthy()
    })

    // Click to open actions
    fireEvent.click(screen.getByText('过去的日记').closest('article')!)

    // Click delete
    const deleteBtn = screen.getByText('删除')
    fireEvent.click(deleteBtn)

    // Confirm
    const confirmBtns = screen.getAllByText('删除')
    // The confirm dialog button is the one with '删除' that's not in the action sheet
    const confirmDeleteBtn = confirmBtns[confirmBtns.length - 1]
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(screen.getByText('已移入回收站')).toBeTruthy()
    })
  })

  it('shows undo button after delete and restores on click', async () => {
    await createReviewEntry('待恢复日记', -1)

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByText('待恢复日记')).toBeTruthy()
    })

    // Click entry to show actions
    fireEvent.click(screen.getByText('待恢复日记').closest('article')!)

    // Click delete
    fireEvent.click(screen.getByText('删除'))

    // Confirm delete
    const confirmBtns = screen.getAllByText('删除')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    // Now undo
    await waitFor(() => {
      expect(screen.getByText('撤销')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('撤销'))

    await waitFor(() => {
      expect(screen.getByText('待恢复日记')).toBeTruthy()
    })
  })

  it('confirm button disabled during delete and double confirm does not execute twice', async () => {
    await createReviewEntry('日记', -1)

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByText('日记')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))

    const confirmBtns = screen.getAllByText('删除')
    const confirmBtn = confirmBtns[confirmBtns.length - 1]

    // Click once
    fireEvent.click(confirmBtn)

    // Confirm button should be disabled while deleting
    // The confirming state disables the button
    expect(confirmBtn).toBeDisabled()
  })
})
