import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

const isTauri = '__TAURI_INTERNALS__' in window
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { router } from './app/router'
import { useSessionStore } from './store/sessionStore'
import { getPreferredLocale, resolveSupportedLocale } from './i18n/config'
import './styles/index.css'

if (!isTauri) {
  registerSW({
    immediate: true,
  })
}

// Sync theme state to/from .dark class on <html>
// Runs before React renders to avoid flash of wrong theme.
const root = document.documentElement
const persistedState = (() => {
  try {
    const raw = localStorage.getItem('doff-session-store')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed.state ?? null
    }
  } catch {
    return null
  }
  return null
})()

const initialTheme = persistedState?.theme === 'dark' || persistedState?.theme === 'light'
  ? persistedState.theme
  : (
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
)
const initialLocale = resolveSupportedLocale(persistedState?.locale) ?? getPreferredLocale()

const applyTheme = (theme: 'light' | 'dark') => {
  root.dataset.theme = theme
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const applyLocale = (locale: string) => {
  root.lang = locale
}

applyTheme(initialTheme)
applyLocale(initialLocale)

useSessionStore.subscribe((state) => {
  applyTheme(state.theme)
  applyLocale(state.locale)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
