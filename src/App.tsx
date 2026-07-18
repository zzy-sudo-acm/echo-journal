import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { BottomNav } from './components/BottomNav'
import { AppHeader } from './components/AppHeader'
import { TodayPage } from './pages/TodayPage'
import { CalendarPage } from './pages/CalendarPage'
import { SearchPage } from './pages/SearchPage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { createDailySnapshot, cleanupOldSnapshots } from './services/snapshot'

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
      bottom: 80,
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

function AppShell() {
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
      <AppHeader />
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <BottomNav />
      <UpdatePrompt />
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
