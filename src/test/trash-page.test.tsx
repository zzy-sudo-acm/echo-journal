import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TrashPage } from '../pages/TrashPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'

function renderTrashPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TrashPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TrashPage', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    await db.entries.clear()
    await db.tags.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows empty state', async () => {
    renderTrashPage()
    await waitFor(() => {
      // Both the header subtitle and the empty body show "回收站是空的。" — get all
      const elements = screen.getAllByText('回收站是空的。')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('restores an entry successfully', async () => {
    const entry = await entryRepo.create({ content: '可恢复日记' })
    await entryRepo.delete(entry.id)

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('可恢复日记')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('恢复'))

    await waitFor(() => {
      expect(screen.getByText('日记已恢复')).toBeTruthy()
    })
  })

  it('shows restore failure toast', async () => {
    const entry = await entryRepo.create({ content: '恢复失败内容' })
    await entryRepo.delete(entry.id)
    // Entry is now in trash

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('恢复失败内容')).toBeTruthy()
    })

    // Permanently delete it out-of-band so restore will fail
    await entryRepo.permanentDelete(entry.id)

    fireEvent.click(screen.getByText('恢复'))

    await waitFor(() => {
      expect(screen.getByText('恢复失败')).toBeTruthy()
    })
  })

  it('permanently deletes an entry', async () => {
    const entry = await entryRepo.create({ content: '彻底删' })
    await entryRepo.delete(entry.id)

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('彻底删')).toBeTruthy()
    })

    const trashBtns = screen.getAllByLabelText('彻底删除')
    fireEvent.click(trashBtns[0])

    await waitFor(() => {
      expect(screen.getByText('确定要彻底删除这条日记吗？此操作不可撤销。')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('彻底删除'))

    await waitFor(() => {
      expect(screen.getByText('已彻底删除')).toBeTruthy()
    })
  })

  it('empties trash successfully', async () => {
    const a = await entryRepo.create({ content: '清空测试A' })
    const b = await entryRepo.create({ content: '清空测试B' })
    await entryRepo.delete(a.id)
    await entryRepo.delete(b.id)

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('清空测试A')).toBeTruthy()
    })

    // Click the header "清空回收站" button
    const buttons = screen.getAllByText('清空回收站')
    fireEvent.click(buttons[0])

    // Confirm dialog appears
    await waitFor(() => {
      expect(screen.getByText(/确定要清空回收站吗？/)).toBeTruthy()
    })

    // Click confirm button in dialog
    const confirmBtns = screen.getAllByText('清空回收站')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    await waitFor(() => {
      expect(screen.getByText('回收站已清空')).toBeTruthy()
    })
  })

  it('restore button is disabled while restoring', async () => {
    const entry = await entryRepo.create({ content: '恢复中' })
    await entryRepo.delete(entry.id)

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('恢复中')).toBeTruthy()
    })

    const restoreBtn = screen.getByText('恢复')
    fireEvent.click(restoreBtn)

    expect(restoreBtn).toBeDisabled()
  })

  it('empty confirm cannot be double-clicked', async () => {
    const a = await entryRepo.create({ content: '双重点击' })
    await entryRepo.delete(a.id)

    renderTrashPage()

    await waitFor(() => {
      expect(screen.getByText('双重点击')).toBeTruthy()
    })

    const buttons = screen.getAllByText('清空回收站')
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(screen.getByText(/确定要清空回收站吗？/)).toBeTruthy()
    })

    const confirmBtns = screen.getAllByText('清空回收站')
    const confirmBtn = confirmBtns[confirmBtns.length - 1]
    fireEvent.click(confirmBtn)
    expect(confirmBtn).toBeDisabled()
  })
})
