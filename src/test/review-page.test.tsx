import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReviewPage } from '../pages/ReviewPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { useEntryStore } from '../store/entryStore'

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
    if (date.getMonth() !== today.getMonth()) date.setDate(28)
    return entryRepo.create({ content, createdAt: date.toISOString() })
  }

  it('shows empty state when no past entries', async () => {
    renderReviewPage()
    await waitFor(() => {
      expect(screen.getByText(/过去的今天还没有记录/)).toBeTruthy()
    })
  })

  it('removes entry and shows toast on successful delete', async () => {
    await createReviewEntry('过去的日记', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('过去的日记')).toBeTruthy() })

    // Open actions -> delete
    fireEvent.click(screen.getByText('过去的日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))

    const confirmBtns = screen.getAllByText('删除')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    await waitFor(() => {
      expect(screen.getByText('已移入回收站')).toBeTruthy()
    })
  })

  it('restores entry after undo click', async () => {
    await createReviewEntry('待恢复日记', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('待恢复日记')).toBeTruthy() })

    fireEvent.click(screen.getByText('待恢复日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))
    fireEvent.click(screen.getAllByText('删除').pop()!)

    await waitFor(() => { expect(screen.getByText('撤销')).toBeTruthy() })
    fireEvent.click(screen.getByText('撤销'))

    await waitFor(() => {
      expect(screen.getByText('待恢复日记')).toBeTruthy()
    })
  })

  it('shows delete failure when deleteEntry rejects', async () => {
    const deleteSpy = vi.spyOn(useEntryStore.getState(), 'deleteEntry')
      .mockRejectedValueOnce(new Error('fail'))

    await createReviewEntry('失败日记', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('失败日记')).toBeTruthy() })

    fireEvent.click(screen.getByText('失败日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))
    fireEvent.click(screen.getAllByText('删除').pop()!)

    await waitFor(() => {
      expect(screen.getByText('删除失败')).toBeTruthy()
    })

    // Entry should still be visible (not removed on failure)
    expect(screen.getByText('失败日记')).toBeTruthy()
    expect(deleteSpy).toHaveBeenCalled()

    deleteSpy.mockRestore()
  })

  it('still shows toast when delete succeeds but loadReview fails', async () => {
    // Create entry so loadReview will have data
    await createReviewEntry('刷新失败日记', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('刷新失败日记')).toBeTruthy() })

    // Spy on loadReview's underlying dependency to make it fail after delete
    const loadSpy = vi.spyOn(entryRepo, 'getOnThisDay')
      .mockRejectedValueOnce(new Error('refresh fail'))

    fireEvent.click(screen.getByText('刷新失败日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))
    fireEvent.click(screen.getAllByText('删除').pop()!)

    // Delete succeeded, toast should show success
    await waitFor(() => {
      expect(screen.getByText('已移入回收站')).toBeTruthy()
    })

    loadSpy.mockRestore()
  })

  it('shows restore failure toast when restore fails', async () => {
    const entry = await createReviewEntry('恢复测试', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('恢复测试')).toBeTruthy() })

    // Delete
    fireEvent.click(screen.getByText('恢复测试').closest('article')!)
    fireEvent.click(screen.getByText('删除'))
    fireEvent.click(screen.getAllByText('删除').pop()!)

    await waitFor(() => { expect(screen.getByText('撤销')).toBeTruthy() })

    // Genuinely cause restore to fail by permanently deleting the entry
    await entryRepo.permanentDelete(entry.id)

    fireEvent.click(screen.getByText('撤销'))

    await waitFor(() => {
      expect(screen.getByText('恢复失败')).toBeTruthy()
    })
  })

  it('only calls deleteEntry once on double confirm clicks', async () => {
    const deleteSpy = vi.spyOn(useEntryStore.getState(), 'deleteEntry')

    await createReviewEntry('一条日记', -1)
    renderReviewPage()
    await waitFor(() => { expect(screen.getByText('一条日记')).toBeTruthy() })

    fireEvent.click(screen.getByText('一条日记').closest('article')!)
    fireEvent.click(screen.getByText('删除'))

    const confirmBtns = screen.getAllByText('删除')
    const confirmBtn = confirmBtns[confirmBtns.length - 1]

    // Click twice quickly
    fireEvent.click(confirmBtn)
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1)
    })

    deleteSpy.mockRestore()
  })
})
