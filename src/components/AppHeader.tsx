import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { FOCUS_QUICK_INPUT_EVENT } from '../utils/events'
import { MoonIcon, SunIcon } from './Icons'

const desktopNavigation = [
  { to: '/calendar', label: '日历' },
  { to: '/search', label: '搜索' },
  { to: '/settings', label: '设置' },
]

export function AppHeader() {
  const { theme, setTheme } = useUIStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const writingButtonRef = useRef<HTMLButtonElement>(null)
  const writingAnimationRef = useRef<Animation | null>(null)
  const writingFocusTimerRef = useRef<number | null>(null)
  const desktopNavigationAnimationsRef = useRef(new Map<HTMLElement, Animation>())
  const buttonRef = useRef<HTMLButtonElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const buttonAnimationRef = useRef<Animation | null>(null)
  const iconAnimationRef = useRef<Animation | null>(null)

  useEffect(() => () => {
    writingAnimationRef.current?.cancel()
    if (writingFocusTimerRef.current !== null) window.clearTimeout(writingFocusTimerRef.current)
    desktopNavigationAnimationsRef.current.forEach((animation) => animation.cancel())
    desktopNavigationAnimationsRef.current.clear()
    buttonAnimationRef.current?.cancel()
    iconAnimationRef.current?.cancel()
  }, [])

  const playDesktopNavigationFeedback = (element: HTMLElement) => {
    const animations = desktopNavigationAnimationsRef.current
    animations.get(element)?.cancel()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animation = element.animate(
      [
        { transform: 'scale(.94)' },
        { transform: 'scaleX(1.05) scaleY(1.01)', offset: .58 },
        { transform: 'scale(1)' },
      ],
      { duration: 250, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    )
    animations.set(element, animation)
    animation.addEventListener('finish', () => {
      if (animations.get(element) === animation) animations.delete(element)
    }, { once: true })
  }

  const handleDesktopWritingClick = (event: MouseEvent<HTMLButtonElement>) => {
    playDesktopNavigationFeedback(event.currentTarget)
    if (pathname !== '/') {
      navigate('/')
      return
    }

    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

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
      <span className="desktop-app-brand">回声日记</span>
      <button
        ref={writingButtonRef}
        type="button"
        className="writing-capsule"
        aria-label="编写日记"
        onClick={handleWritingClick}
      >
        编写
      </button>
      <div className="app-header-controls">
        <nav className="desktop-header-nav" aria-label="桌面导航">
          <button
            type="button"
            className={`desktop-nav-bubble ${pathname === '/' ? 'is-active' : ''}`}
            aria-current={pathname === '/' ? 'page' : undefined}
            onClick={handleDesktopWritingClick}
          >
            编写
          </button>
          {desktopNavigation.map(({ to, label }) => {
            const selected = pathname === to || (to === '/settings' && (pathname === '/review' || pathname === '/trash'))
            return (
              <Link
                key={to}
                to={to}
                className={`desktop-nav-bubble ${selected ? 'is-active' : ''}`}
                aria-current={selected ? 'page' : undefined}
                onClick={(event) => playDesktopNavigationFeedback(event.currentTarget)}
              >
                {label}
              </Link>
            )
          })}
        </nav>
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
      </div>
    </header>
  )
}
