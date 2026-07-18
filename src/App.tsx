import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { BottomNav } from './components/BottomNav'
import { AppHeader } from './components/AppHeader'
import { TodayPage } from './pages/TodayPage'
import { CalendarPage } from './pages/CalendarPage'
import { SearchPage } from './pages/SearchPage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { TrashPage } from './pages/TrashPage'
import { createDailySnapshot, cleanupOldSnapshots } from './services/snapshot'
import { useEntryStore } from './store/entryStore'
import { Capacitor } from '@capacitor/core'

function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          }
        })
      })
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--nav-height) + var(--nav-bottom-gap) + var(--safe-bottom) + 16px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 500,
      background: 'var(--accent)',
      color: 'var(--on-accent)',
      padding: '10px 20px',
      borderRadius: 'var(--radius)',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer',
      boxShadow: 'var(--shadow)',
    }}
      onClick={() => window.location.reload()}
    >
      新版本可用，点击更新
    </div>
  )
}

function RouteScrollManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/') window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export function MidnightChecker() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const check = () => {
      try {
        useEntryStore.getState().checkDateChange()
      } catch {
        // Date check failure is non-critical
      }
    }

    // Check on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Schedule next midnight check recursively, tracking the timer
    const scheduleMidnightCheck = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const msUntilMidnight = midnight.getTime() - now.getTime()
      timer = setTimeout(() => {
        check()
        scheduleMidnightCheck()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightCheck()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [])

  return null
}

function getNavigationIndex(pathname: string) {
  if (pathname === '/') return 0
  if (pathname === '/calendar') return 1
  if (pathname === '/search') return 2
  if (pathname === '/settings' || pathname === '/review' || pathname === '/trash') return 3
  return -1
}

function AppShell() {
  const location = useLocation()
  const currentIndex = getNavigationIndex(location.pathname)
  const previousIndex = useRef(currentIndex)
  const direction = currentIndex < 0 || currentIndex === previousIndex.current
    ? 'none'
    : currentIndex > previousIndex.current
      ? 'right'
      : 'left'

  useLayoutEffect(() => {
    previousIndex.current = currentIndex
  }, [currentIndex])

  // Daily snapshot on first open
  useEffect(() => {
    const checkAndSnapshot = async () => {
      try {
        await createDailySnapshot()
        await cleanupOldSnapshots()
      } catch {
        // Silent fail — snapshots are best-effort
      }
    }
    checkAndSnapshot()
  }, [])

  return (
    <div className="app-shell">
      <RouteScrollManager />
      <MidnightChecker />
      <AppHeader />
      <div className={`route-content route-enter-${direction}`} key={location.key}>
        <Routes location={location}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/trash" element={<TrashPage />} />
        </Routes>
      </div>
      <BottomNav />
      {!Capacitor.isNativePlatform() ? <UpdatePrompt /> : null}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </HashRouter>
  )
}
