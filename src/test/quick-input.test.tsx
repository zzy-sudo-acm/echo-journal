import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QuickInput } from '../components/QuickInput'
import { db } from '../db/database'
import { draftRepo } from '../db/repository'

describe('QuickInput', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.drafts.clear()
    await db.tags.clear()
  })

  afterEach(() => cleanup())

  it('reveals tags on demand, restores the full draft, and saves with the current time', async () => {
    const { unmount } = render(<QuickInput />)
    const textarea = screen.getByPlaceholderText('这里还很安静')

    expect(screen.queryByText('记下')).toBeNull()
    expect(document.querySelector("input[type='datetime-local']")).toBeNull()

    fireEvent.focus(textarea)
    expect(textarea.getAttribute('placeholder')).toBe('写下此刻…')
    fireEvent.change(textarea, { target: { value: '一段临时想法' } })
    expect(screen.getByText('记下')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    const tagInput = screen.getByLabelText('输入标签，按回车添加')
    fireEvent.change(tagInput, { target: { value: '灵感' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    await waitFor(async () => {
      const draft = await draftRepo.get()
      expect(draft?.content).toBe('一段临时想法')
      expect(draft?.tags).toEqual(['灵感'])
    }, { timeout: 2500 })

    unmount()
    render(<QuickInput />)

    const restored = await screen.findByDisplayValue('一段临时想法')
    expect(screen.getByText('#灵感')).toBeTruthy()
    expect(screen.queryByLabelText('输入标签，按回车添加')).toBeNull()

    const beforeSave = Date.now()
    fireEvent.keyDown(restored, { key: 'Enter', ctrlKey: true })

    await waitFor(async () => {
      const entries = await db.entries.toArray()
      expect(entries).toHaveLength(1)
      expect(entries[0].content).toBe('一段临时想法')
      expect(entries[0].tags).toEqual(['灵感'])
      expect(new Date(entries[0].createdAt).getTime()).toBeGreaterThanOrEqual(beforeSave)
      expect(await draftRepo.get()).toBeNull()
    })

    expect(screen.queryByText('记下')).toBeNull()
    expect((restored as HTMLTextAreaElement).value).toBe('')
    fireEvent.blur(restored)
    expect(restored.getAttribute('placeholder')).toBe('这里还很安静')
  })

  it('focuses the composer when its focus request changes', () => {
    const { rerender } = render(<QuickInput focusRequest={0} />)
    const textarea = screen.getByPlaceholderText('这里还很安静')

    rerender(<QuickInput focusRequest={1} />)

    expect(document.activeElement).toBe(textarea)
    expect(textarea.getAttribute('placeholder')).toBe('写下此刻…')
  })
})
