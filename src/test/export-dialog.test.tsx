import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportDialog } from '../components/ExportDialog'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'

describe('ExportDialog', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    await db.entries.clear()
    await db.tags.clear()
    await db.snapshots.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows active and trash counts separately', async () => {
    await entryRepo.create({ content: '正常日记', tags: ['日常'] })
    const deleted = await entryRepo.create({ content: '已删日记', tags: ['删除'] })
    await entryRepo.delete(deleted.id)

    render(<ExportDialog onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('正常日记')).toBeTruthy()
      expect(screen.getByText('回收站')).toBeTruthy()
    })

    // Get the numeric values next to labels
    const activeRow = screen.getByText('正常日记').closest('.preview-row')!
    expect(activeRow.textContent).toContain('1 条')

    const trashRow = screen.getByText('回收站').closest('.preview-row')!
    expect(trashRow.textContent).toContain('1 条')

    expect(screen.getByText('标签数量')).toBeTruthy()
    expect(screen.getByText('2 个')).toBeTruthy()
  })

  it('does not show trash row when trash is empty', async () => {
    await entryRepo.create({ content: '只有正常' })

    render(<ExportDialog onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('正常日记')).toBeTruthy()
    })

    expect(screen.queryByText('回收站')).toBeNull()
  })

  it('shows correct export copy distinguishing backup.json and journal.md', async () => {
    await entryRepo.create({ content: '测试' })

    render(<ExportDialog onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/backup.json 包含完整恢复数据/)).toBeTruthy()
      expect(screen.getByText(/journal.md 只包含当前正常日记/)).toBeTruthy()
    })
  })

  it('does not show old "阅读所有日记" text', async () => {
    await entryRepo.create({ content: '测试' })

    render(<ExportDialog onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('正常日记')).toBeTruthy()
    })

    // The old text should not appear
    expect(screen.queryByText(/阅读所有日记/)).toBeNull()
  })
})
