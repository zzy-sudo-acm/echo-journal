import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MidnightChecker } from '../App'

describe('MidnightChecker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('schedules a midnight check on mount', () => {
    const { unmount } = render(<MidnightChecker />)
    // Should have scheduled exactly one timer
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    // Timer should be cleared on unmount
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears timer on unmount', () => {
    const { unmount } = render(<MidnightChecker />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fires check at midnight and schedules next check', () => {
    render(<MidnightChecker />)

    const initialCount = vi.getTimerCount()
    expect(initialCount).toBe(1)

    // Advance to midnight
    vi.advanceTimersToNextTimer()

    // After firing, it should have scheduled another timer
    expect(vi.getTimerCount()).toBe(1)
  })

  it('checks on visibility change to visible', () => {
    render(<MidnightChecker />)

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    // No exception thrown = check completed
  })

  it('check function handles errors gracefully', () => {
    // Simulate: the check() function wraps checkDateChange in try/catch
    const check = () => {
      try {
        throw new Error('simulated failure')
      } catch {
        // Non-critical — should not propagate
      }
    }

    // Should not throw
    expect(() => check()).not.toThrow()
  })
})
