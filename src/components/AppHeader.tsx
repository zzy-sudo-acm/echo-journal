import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { FOCUS_QUICK_INPUT_EVENT } from '../utils/events'
import { MoonIcon, SunIcon } from './Icons'

export function AppHeader() {
  const { theme, setTheme } = useUIStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const writingButtonRef = useRef<HTMLButtonElement>(null)
  const writingAnimationRef = useRef<Animation | null>(null)
  const writingFocusTimerRef = useRef<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const buttonAnimationRef = useRef<Animation | null>(null)
  const iconAnimationRef = useRef<Animation | null>(null)

  useEffect(() => () => {
    writingAnimationRef.current?.cancel()
    if (writingFocusTimerRef.current !== null) window.clearTimeout(writingFocusTimerRef.current)
    buttonAnimationRef.current?.cancel()
    iconAnimationRef.current?.cancel()
  }, [])

  const handleWritingClick = () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    writingAnimationRef.current?.cancel()

    if (!reducedMotion) {
      writingAnimationRef.current = writingButtonRef.current?.animate(
        [
          { transform: 'scale(.95)' },
          { transform: 'scaleX(1.07) scaleY(1.01)', offset: .58 },
          { transform: 'scale(1)' },
        ],
        { duration: 270, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      ) ?? null
    }

    const focusQuickInput = () => window.dispatchEvent(new Event(FOCUS_QUICK_INPUT_EVENT))
    if (pathname === '/') {
      if (writingFocusTimerRef.current === null) focusQuickInput()
      return
    }

    if (writingFocusTimerRef.current !== null) window.clearTimeout(writingFocusTimerRef.current)
    navigate('/')
    writingFocusTimerRef.current = window.setTimeout(() => {
      writingFocusTimerRef.current = null
      focusQuickInput()
    }, reducedMotion ? 32 : 300)
  }

  const handleThemeToggle = () => {
    buttonAnimationRef.current?.cancel()
    iconAnimationRef.current?.cancel()

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      buttonAnimationRef.current = buttonRef.current?.animate(
        [
          { transform: 'scale(.94)' },
          { transform: 'scale(1.04)', offset: .58 },
          { transform: 'scale(1)' },
        ],
        { duration: 250, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      ) ?? null
      iconAnimationRef.current = iconRef.current?.animate(
        [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(13deg)', offset: .58 },
          { transform: 'rotate(0deg)' },
        ],
        { duration: 250, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      ) ?? null
    }

    void setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="app-header">
      <button
        ref={writingButtonRef}
        type="button"
        className="writing-capsule"
        aria-label="编写日记"
        onClick={handleWritingClick}
      >
        编写
      </button>
      <button
        ref={buttonRef}
        type="button"
        className="theme-toggle-bubble"
        aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        onClick={handleThemeToggle}
      >
        <span ref={iconRef} className="theme-toggle-icon" aria-hidden="true">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </span>
      </button>
    </header>
  )
}
