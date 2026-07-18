import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { MoonIcon, SunIcon } from './Icons'

export function AppHeader() {
  const { theme, setTheme } = useUIStore()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const buttonAnimationRef = useRef<Animation | null>(null)
  const iconAnimationRef = useRef<Animation | null>(null)

  useEffect(() => () => {
    buttonAnimationRef.current?.cancel()
    iconAnimationRef.current?.cancel()
  }, [])

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
      <Link className="app-brand" to="/" aria-label="回声日记首页">回声日记</Link>
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
