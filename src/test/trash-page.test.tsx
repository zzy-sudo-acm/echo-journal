import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TrashPage } from '../pages/TrashPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { useEntryStore } from '../store/entryStore'

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
      const elements = screen.getAllByText('回收站是空的。')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('restores an entry successfully', async () => {
    const entry = await entryRepo.create({ content: '可恢复日记' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('可恢复日记')).toBeTruthy() })
    fireEvent.click(screen.getByText('恢复'))
    await waitFor(() => { expect(screen.getByText('日记已恢复')).toBeTruthy() })
  })

  it('shows restore failure toast', async () => {
    const entry = await entryRepo.create({ content: '恢复失败内容' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('恢复失败内容')).toBeTruthy() })
    await entryRepo.permanentDelete(entry.id)
    fireEvent.click(screen.getByText('恢复'))
    await waitFor(() => { expect(screen.getByText('恢复失败')).toBeTruthy() })
  })

  it('permanently deletes an entry', async () => {
    const entry = await entryRepo.create({ content: '彻底删' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('彻底删')).toBeTruthy() })
    fireEvent.click(screen.getAllByLabelText('彻底删除')[0])
    await waitFor(() => { expect(screen.getByText('确定要彻底删除这条日记吗？此操作不可撤销。')).toBeTruthy() })
    fireEvent.click(screen.getByText('彻底删除'))
    await waitFor(() => { expect(screen.getByText('已彻底删除')).toBeTruthy() })
  })

  it('shows permanent delete failure and keeps entry on page', async () => {
    const entry = await entryRepo.create({ content: '删失败' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('删失败')).toBeTruthy() })

    const permSpy = vi.spyOn(useEntryStore.getState(), 'permanentDeleteEntry')
      .mockRejectedValueOnce(new Error('fail'))

    fireEvent.click(screen.getAllByLabelText('彻底删除')[0])
    await waitFor(() => { expect(screen.getByText('彻底删除')).toBeTruthy() })
    fireEvent.click(screen.getByText('彻底删除'))

    await waitFor(() => { expect(screen.getByText('彻底删除失败')).toBeTruthy() })
    // Entry still on page
    expect(screen.getByText('删失败')).toBeTruthy()
    expect(permSpy).toHaveBeenCalledTimes(1)
    permSpy.mockRestore()
  })

  it('shows empty failure toast and keeps entries', async () => {
    const a = await entryRepo.create({ content: '清空失败A' })
    await entryRepo.delete(a.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('清空失败A')).toBeTruthy() })

    const emptySpy = vi.spyOn(useEntryStore.getState(), 'emptyTrash')
      .mockRejectedValueOnce(new Error('fail'))

    fireEvent.click(screen.getAllByText('清空回收站')[0])
    await waitFor(() => { expect(screen.getByText(/确定要清空回收站吗？/)).toBeTruthy() })
    fireEvent.click(screen.getAllByText('清空回收站').pop()!)

    await waitFor(() => { expect(screen.getByText('清空回收站失败')).toBeTruthy() })
    expect(screen.getByText('清空失败A')).toBeTruthy()
    expect(emptySpy).toHaveBeenCalledTimes(1)
    emptySpy.mockRestore()
  })

  it('restore button is disabled while restoring', async () => {
    const entry = await entryRepo.create({ content: '恢复中' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('恢复中')).toBeTruthy() })
    const restoreBtn = screen.getByText('恢复')
    fireEvent.click(restoreBtn)
    expect(restoreBtn).toBeDisabled()
  })

  it('cannot close permanent delete dialog by clicking overlay while executing', async () => {
    const entry = await entryRepo.create({ content: '遮罩关闭' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('遮罩关闭')).toBeTruthy() })

    // Mock to keep it pending
    const permSpy = vi.spyOn(useEntryStore.getState(), 'permanentDeleteEntry')
      .mockImplementation(() => new Promise(() => {})) // never resolves

    fireEvent.click(screen.getAllByLabelText('彻底删除')[0])
    await waitFor(() => { expect(screen.getByText('彻底删除')).toBeTruthy() })
    fireEvent.click(screen.getByText('彻底删除'))

    // Now try clicking the overlay
    const overlay = document.querySelector('.confirm-overlay')!
    fireEvent.click(overlay)

    // Confirm dialog should still be visible (not closed)
    expect(screen.getByText('执行中…')).toBeTruthy()

    permSpy.mockRestore()
  })

  it('calls permanentDeleteEntry only once on double click', async () => {
    const entry = await entryRepo.create({ content: '双重点' })
    await entryRepo.delete(entry.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('双重点')).toBeTruthy() })

    const permSpy = vi.spyOn(useEntryStore.getState(), 'permanentDeleteEntry')

    fireEvent.click(screen.getAllByLabelText('彻底删除')[0])
    await waitFor(() => { expect(screen.getByText('彻底删除')).toBeTruthy() })

    const btn = screen.getByText('彻底删除')
    fireEvent.click(btn)
    fireEvent.click(btn)

    await waitFor(() => { expect(permSpy).toHaveBeenCalledTimes(1) })
    permSpy.mockRestore()
  })

  it('empties trash successfully', async () => {
    const a = await entryRepo.create({ content: '清空测试A' })
    await entryRepo.delete(a.id)
    renderTrashPage()
    await waitFor(() => { expect(screen.getByText('清空测试A')).toBeTruthy() })

    fireEvent.click(screen.getAllByText('清空回收站')[0])
    await waitFor(() => { expect(screen.getByText(/确定要清空回收站吗？/)).toBeTruthy() })
    fireEvent.click(screen.getAllByText('清空回收站').pop()!)

    await waitFor(() => { expect(screen.getByText('回收站已清空')).toBeTruthy() })
  })
})
