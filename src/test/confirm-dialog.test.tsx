import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(() => cleanup())

  it('calls onCancel once when overlay is clicked', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog message="test" onCancel={onCancel} onConfirm={onConfirm} />,
    )

    fireEvent.click(document.querySelector('.confirm-overlay')!)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not call onCancel on overlay when confirming', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog message="test" onCancel={onCancel} onConfirm={onConfirm} confirming />,
    )

    fireEvent.click(document.querySelector('.confirm-overlay')!)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('disables both buttons when confirming', () => {
    render(
      <ConfirmDialog message="test" onCancel={vi.fn()} onConfirm={vi.fn()} confirming danger />,
    )

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  it('shows "执行中…" when confirming', () => {
    render(
      <ConfirmDialog message="test" confirmLabel="删除" onCancel={vi.fn()} onConfirm={vi.fn()} confirming />,
    )

    expect(screen.getByText('执行中…')).toBeTruthy()
  })

  it('clicking inside the box does not trigger onCancel', () => {
    const onCancel = vi.fn()

    render(
      <ConfirmDialog message="test" onCancel={onCancel} onConfirm={vi.fn()} />,
    )

    fireEvent.click(document.querySelector('.confirm-box')!)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog message="test" confirmLabel="确认删除" onCancel={vi.fn()} onConfirm={onConfirm} danger />,
    )

    fireEvent.click(screen.getByText('确认删除'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
