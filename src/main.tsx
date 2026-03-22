import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { router } from './app/router'
import { useSessionStore } from './store/sessionStore'
import './styles/index.css'

registerSW({
  immediate: true,
})

// Sync theme state to/from .dark class on <html>
// Runs before React renders to avoid flash of wrong theme.
const root = document.documentElement
const persistedTheme = (() => {
  try {
    const raw = localStorage.getItem('doff-session-store')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.state?.theme === 'dark' || parsed.state?.theme === 'light') {
        return parsed.state.theme
      }
    }
  } catch {}
  return null
})()

const initialTheme = persistedTheme ?? (
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
)

const applyTheme = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

applyTheme(initialTheme)

useSessionStore.subscribe((state) => {
  applyTheme(state.theme)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
