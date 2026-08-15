import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { BottomNav } from './components/BottomNav'
import { AppHeader } from './components/AppHeader'
import { TodayPage } from './pages/TodayPage'
import { createDailySnapshot, cleanupOldSnapshots } from './services/snapshot'
import { useEntryStore } from './store/entryStore'
import { initBackHandler } from './utils/backHandler'
import { Capacitor } from '@capacitor/core'

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TrashPage = lazy(() => import('./pages/TrashPage').then((m) => ({ default: m.TrashPage })))

function PageLoadingFallback() {
  return (
    <div className="page">
      <p className="timeline-empty">加载中…</p>
    </div>
  )
}

function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    const cancelled = { value: false }

    const checkForUpdate = () => {
      registration?.update().catch(() => {
        // Best-effort; the browser also checks on its own schedule.
      })
    }

    void navigator.serviceWorker.ready.then((reg) => {
      if (cancelled.value) return
      registration = reg

      // A worker can already be waiting when this component mounts (e.g. an
      // update arrived before the listener was attached).
      if (reg.waiting) setUpdateAvailable(true)

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })

      // With autoUpdate the new worker activates on its own; reloading is
      // still required to pick up the new assets.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true)
      })

      // Hash-routed SPA sessions never perform a real navigation, so ask the
      // browser to check for updates on a regular cadence and when returning.
      checkForUpdate()
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    interval = setInterval(checkForUpdate, 30 * 60 * 1000)

    return () => {
      cancelled.value = true
      document.removeEventListener('visibilitychange', handleVisibility)
      if (interval) clearInterval(interval)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <button type="button" className="update-prompt" onClick={() => window.location.reload()}>
      新版本可用，点击更新
    </button>
  )
}

function RouteScrollManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    // The timeline restores its own scroll position on mount.
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
  const navigate = useNavigate()
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

  // Hardware back button: close topmost overlay → collapse keyboard → back to
  // the timeline tab → background the app. No-op off native platforms.
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  useEffect(() => {
    return initBackHandler({
      navigateHome: () => navigate('/'),
      isHome: () => pathnameRef.current === '/',
    })
  }, [navigate])

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
      <div className={`route-content route-enter-${direction}`} key={location.pathname}>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes location={location}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/trash" element={<TrashPage />} />
          </Routes>
        </Suspense>
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
