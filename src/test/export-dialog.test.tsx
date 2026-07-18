import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  function getExportButton() {
    // The export button is the .btn-primary with DownloadIcon
    return document.querySelector('.btn-primary.btn-block') as HTMLButtonElement
  }

  it('shows active and trash counts separately', async () => {
    await entryRepo.create({ content: '正常日记', tags: ['日常'] })
    const deleted = await entryRepo.create({ content: '已删日记', tags: ['删除'] })
    await entryRepo.delete(deleted.id)

    render(<ExportDialog onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('正常日记')).toBeTruthy()
      expect(screen.getByText('回收站')).toBeTruthy()
    })

    const activeRow = screen.getByText('正常日记').closest('.preview-row')!
    expect(activeRow.textContent).toContain('1 条')
    const trashRow = screen.getByText('回收站').closest('.preview-row')!
    expect(trashRow.textContent).toContain('1 条')
    expect(screen.getByText('2 个')).toBeTruthy()
  })

  it('does not show trash row when trash is empty', async () => {
    await entryRepo.create({ content: '只有正常' })
    render(<ExportDialog onClose={vi.fn()} />)
    await waitFor(() => { expect(screen.getByText('正常日记')).toBeTruthy() })
    expect(screen.queryByText('回收站')).toBeNull()
  })

  it('shows correct export copy', async () => {
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
    await waitFor(() => { expect(screen.getByText('正常日记')).toBeTruthy() })
    expect(screen.queryByText(/阅读所有日记/)).toBeNull()
  })

  it('shows preview after loading', async () => {
    await entryRepo.create({ content: '一条日记' })
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('正在准备备份数据…')).toBeTruthy()
    await waitFor(() => { expect(getExportButton()).toBeTruthy() })
  })

  it('shows error state when generateBackupData fails', async () => {
    await db.delete()
    render(<ExportDialog onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('无法读取本地数据，请稍后重试。')).toBeTruthy()
    })
    expect(screen.queryByText('正在准备备份数据…')).toBeNull()
    await db.open()
  })

  it('disables export button while exporting', async () => {
    await entryRepo.create({ content: '测试' })
    const backupModule = await import('../services/backup')
    vi.spyOn(backupModule, 'createExportZip').mockImplementation(
      () => new Promise(() => {}),
    )

    render(<ExportDialog onClose={vi.fn()} />)
    await waitFor(() => { expect(getExportButton()).toBeTruthy() })

    fireEvent.click(getExportButton())

    await waitFor(() => {
      expect(screen.getByText('正在导出…')).toBeTruthy()
    })

    vi.mocked(backupModule.createExportZip).mockRestore()
  })

  it('shows export error when export fails', async () => {
    await entryRepo.create({ content: '测试' })
    const backupModule = await import('../services/backup')
    vi.spyOn(backupModule, 'createExportZip').mockRejectedValue(new Error('fail'))

    render(<ExportDialog onClose={vi.fn()} />)
    await waitFor(() => { expect(getExportButton()).toBeTruthy() })

    fireEvent.click(getExportButton())

    await waitFor(() => {
      expect(screen.getByText('导出失败，请稍后重试。')).toBeTruthy()
    })

    vi.mocked(backupModule.createExportZip).mockRestore()
  })

  it('calls onClose after successful export', async () => {
    await entryRepo.create({ content: '测试' })
    const onClose = vi.fn()
    const backupModule = await import('../services/backup')
    vi.spyOn(backupModule, 'createExportZip').mockResolvedValue(new Blob(['test'], { type: 'application/zip' }))

    render(<ExportDialog onClose={onClose} />)
    await waitFor(() => { expect(getExportButton()).toBeTruthy() })

    fireEvent.click(getExportButton())

    await waitFor(() => { expect(onClose).toHaveBeenCalled() })

    vi.mocked(backupModule.createExportZip).mockRestore()
  })
})
