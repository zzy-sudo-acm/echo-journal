import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useUIStore } from './store/uiStore'

async function bootstrap() {
  try {
    await useUIStore.getState().initAppearance()
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-journal-font', 'modern')
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
