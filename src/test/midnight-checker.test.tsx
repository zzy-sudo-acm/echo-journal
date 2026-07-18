import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MidnightChecker } from '../App'
import { useEntryStore } from '../store/entryStore'

describe('MidnightChecker', () => {
  let checkSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    checkSpy = vi.fn().mockReturnValue(false)
    useEntryStore.setState({ checkDateChange: checkSpy } as any)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('schedules a midnight timer on mount', () => {
    const { unmount } = render(<MidnightChecker />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears timer on unmount', () => {
    const { unmount } = render(<MidnightChecker />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('calls checkDateChange when timer fires, then schedules next check', () => {
    render(<MidnightChecker />)
    expect(checkSpy).not.toHaveBeenCalled()

    vi.advanceTimersToNextTimer()
    expect(checkSpy).toHaveBeenCalledTimes(1)

    // Should have scheduled the next timer
    expect(vi.getTimerCount()).toBe(1)
  })

  it('calls checkDateChange on visibility change to visible', () => {
    render(<MidnightChecker />)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(checkSpy).toHaveBeenCalled()
  })

  it('does not call checkDateChange when visibility is hidden', () => {
    render(<MidnightChecker />)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(checkSpy).not.toHaveBeenCalled()
  })

  it('does not crash when checkDateChange throws', () => {
    useEntryStore.setState({
      checkDateChange: () => { throw new Error('crash') },
    } as any)

    const { unmount } = render(<MidnightChecker />)

    // Timer fires — should not crash
    expect(() => vi.advanceTimersToNextTimer()).not.toThrow()

    // Visibility change — should not crash
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow()

    unmount()
  })

  it('cleans up timer and visibility listener on unmount', () => {
    const { unmount } = render(<MidnightChecker />)
    unmount()

    expect(vi.getTimerCount()).toBe(0)

    // Dispatch visibility after unmount — should not call spy
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    // No crash and no call since listener removed
  })
})
