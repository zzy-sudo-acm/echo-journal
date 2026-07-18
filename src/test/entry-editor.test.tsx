import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryEditor } from '../components/EntryEditor'
import type { Entry } from '../db/models'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'test-1',
    title: '原标题',
    content: '原内容',
    tags: ['原标签'],
    createdAt: '2026-07-18T10:00:00.000Z',
    updatedAt: '2026-07-18T10:00:00.000Z',
    isDraft: false,
    ...overrides,
  }
}

describe('EntryEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('calls onClose directly when nothing was modified', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()

    render(<EntryEditor entry={makeEntry()} onSave={onSave} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('关闭编辑器'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows confirm dialog when content was modified', async () => {
    const onClose = vi.fn()
    render(<EntryEditor entry={makeEntry()} onSave={vi.fn()} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('写下此刻…')
    fireEvent.change(textarea, { target: { value: '修改后的内容' } })

    fireEvent.click(screen.getByLabelText('关闭编辑器'))

    await waitFor(() => {
      expect(screen.getByText('尚有未保存的修改，确定要放弃吗？')).toBeTruthy()
    })
  })

  it('shows confirm dialog when title was modified', async () => {
    const onClose = vi.fn()
    render(<EntryEditor entry={makeEntry()} onSave={vi.fn()} onClose={onClose} />)

    const titleInput = screen.getByPlaceholderText('给这一刻起个名字')
    fireEvent.change(titleInput, { target: { value: '新标题' } })

    fireEvent.click(screen.getByLabelText('关闭编辑器'))
    await waitFor(() => {
      expect(screen.getByText('尚有未保存的修改，确定要放弃吗？')).toBeTruthy()
    })
  })

  it('"继续编辑" closes only the confirm dialog, not the editor', async () => {
    const onClose = vi.fn()
    render(<EntryEditor entry={makeEntry()} onSave={vi.fn()} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('写下此刻…')
    fireEvent.change(textarea, { target: { value: '修改' } })
    fireEvent.click(screen.getByLabelText('关闭编辑器'))

    await waitFor(() => {
      expect(screen.getByText('继续编辑')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('继续编辑'))
    // Editor should still be open, onClose not called
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('修改')).toBeTruthy()
  })

  it('clicking confirm overlay only closes the confirm dialog', async () => {
    const onClose = vi.fn()
    render(<EntryEditor entry={makeEntry()} onSave={vi.fn()} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('写下此刻…')
    fireEvent.change(textarea, { target: { value: '修改' } })
    fireEvent.click(screen.getByLabelText('关闭编辑器'))

    await waitFor(() => {
      expect(screen.getByText('继续编辑')).toBeTruthy()
    })

    fireEvent.click(document.querySelector('.confirm-overlay')!)
    // Editor should still be open
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('修改')).toBeTruthy()
  })

  it('"放弃修改" calls onClose', async () => {
    const onClose = vi.fn()
    render(<EntryEditor entry={makeEntry()} onSave={vi.fn()} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('写下此刻…')
    fireEvent.change(textarea, { target: { value: '修改' } })
    fireEvent.click(screen.getByLabelText('关闭编辑器'))

    await waitFor(() => {
      expect(screen.getByText('放弃修改')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('放弃修改'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not show confirm after successful save', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<EntryEditor entry={makeEntry()} onSave={onSave} onClose={onClose} />)

    const textarea = screen.getByPlaceholderText('写下此刻…')
    fireEvent.change(textarea, { target: { value: '保存的内容' } })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('saves with empty title as empty string', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const entry = makeEntry({ title: '有标题' })

    render(<EntryEditor entry={entry} onSave={onSave} onClose={vi.fn()} />)

    const titleInput = screen.getByPlaceholderText('给这一刻起个名字')
    fireEvent.change(titleInput, { target: { value: '' } })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: '' }),
      )
    })
  })

  it('saves with empty tags as empty array', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const entry = makeEntry({ tags: ['标签1', '标签2'] })

    render(<EntryEditor entry={entry} onSave={onSave} onClose={vi.fn()} />)

    // Remove all tags by clicking X on each
    const removeButtons = screen.getAllByLabelText(/移除标签/)
    for (const btn of removeButtons) fireEvent.click(btn)

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] }),
      )
    })
  })

  it('shows error for empty date and prevents save', () => {
    const onSave = vi.fn()

    render(<EntryEditor entry={makeEntry()} onSave={onSave} onClose={vi.fn()} />)

    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    // Use fireEvent.input to trigger the onInput handler
    fireEvent.input(dateInput, { target: { value: '' } })

    const saveBtn = screen.getByText('保存')
    fireEvent.click(saveBtn)

    expect(screen.getByText('请选择有效的时间')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })
})
