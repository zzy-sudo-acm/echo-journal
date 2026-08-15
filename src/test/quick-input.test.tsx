import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QuickInput } from '../components/QuickInput'
import { db } from '../db/database'
import { draftRepo } from '../db/repository'

class MockVisualViewport extends EventTarget {
  height = 800
}

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

  it('folds the composer after the Android keyboard is dismissed without a blur event', async () => {
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const viewport = new MockVisualViewport()
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })

    try {
      render(<QuickInput />)
      const textarea = screen.getByPlaceholderText('这里还很安静')
      const composer = screen.getByLabelText('快速记录')

      textarea.focus()
      fireEvent.change(textarea, { target: { value: '键盘收起后仍保留的草稿' } })
      expect(document.activeElement).toBe(textarea)
      expect(composer.classList.contains('is-expanded')).toBe(true)

      viewport.height = 460
      viewport.dispatchEvent(new Event('resize'))
      viewport.height = 800
      viewport.dispatchEvent(new Event('resize'))

      await waitFor(() => {
        expect(composer.classList.contains('is-expanded')).toBe(false)
        expect(document.activeElement).not.toBe(textarea)
      })
      expect((textarea as HTMLTextAreaElement).value).toBe('键盘收起后仍保留的草稿')
    } finally {
      if (originalViewport) {
        Object.defineProperty(window, 'visualViewport', originalViewport)
      } else {
        Reflect.deleteProperty(window, 'visualViewport')
      }
    }
  })

  it('saves immediately without stale draft resurrecting after save', async () => {
    // Type content and immediately save (before draft debounce fires)
    render(<QuickInput />)
    const textarea = screen.getByPlaceholderText('这里还很安静')

    fireEvent.focus(textarea)
    fireEvent.change(textarea, { target: { value: '快速保存的内容' } })

    // Immediately save without waiting for draft debounce
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    // Wait for save to complete
    await waitFor(async () => {
      const entries = await db.entries.toArray()
      expect(entries).toHaveLength(1)
      expect(entries[0].content).toBe('快速保存的内容')
    })

    // Wait a bit more to ensure no stale draft reappears
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Draft should still be null — no stale draft resurrection
    const draft = await draftRepo.get()
    expect(draft).toBeNull()
  })

  it('flushes a pending debounce draft when unmounted before the timer fires', async () => {
    const view = render(<QuickInput />)
    const textarea = screen.getByPlaceholderText('这里还很安静')

    fireEvent.focus(textarea)
    fireEvent.change(textarea, { target: { value: '刚写完就切走的内容' } })

    // The visible "saving" label means draftLoaded=true and the 600ms timer
    // has been scheduled; unmounting now would previously cancel it.
    await screen.findByText('存草稿中…')
    view.unmount()

    await waitFor(async () => {
      const draft = await draftRepo.get()
      expect(draft?.content).toBe('刚写完就切走的内容')
    })
  })

  it('stores lightweight markup as rich content on save', async () => {
    render(<QuickInput />)
    const textarea = screen.getByPlaceholderText('这里还很安静')

    fireEvent.focus(textarea)
    fireEvent.change(textarea, { target: { value: '## 今天的收获\n- 读了书\n- 跑了步' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    await waitFor(async () => {
      const entries = await db.entries.toArray()
      expect(entries).toHaveLength(1)
      const rich = entries[0].richContent
      expect(rich).toBeTruthy()
      expect(rich!.content![0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
      expect(rich!.content![1].type).toBe('bulletList')
      // Plain-text mirror stays searchable
      expect(entries[0].content).toContain('今天的收获')
    })
  })

  it('restores images attached to a saved quick-composer draft', async () => {
    await db.media.put({
      id: 'draft-media',
      blob: new Blob(['x'], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 1,
      height: 1,
      createdAt: new Date().toISOString(),
    })
    await draftRepo.save({ content: '带图草稿', title: '', tags: [], mediaIds: ['draft-media'] })

    render(<QuickInput />)

    // The restored draft shows its image thumb and keeps mediaIds for the
    // next auto-save / unmount flush.
    expect(await screen.findByLabelText('移除图片')).toBeTruthy()
    const draft = await draftRepo.get()
    expect(draft?.mediaIds).toEqual(['draft-media'])
  })
})
