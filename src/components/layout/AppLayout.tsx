import { NavLink, Outlet } from 'react-router-dom'
import { useSessionStore } from '../../store/sessionStore'

const NAV_ITEMS = [
  { label: 'Text', to: '/text' },
  { label: 'Images', to: '/images' },
  { label: 'Documents', to: '/documents' },
  { label: 'Spreadsheets', to: '/spreadsheets' },
  { label: 'Folders', to: '/folders' },
  { label: 'Settings', to: '/settings' },
  { label: 'About/Privacy', to: '/about/privacy' },
]

export function AppLayout() {
  const theme = useSessionStore((state) => state.theme)
  const toggleTheme = useSessionStore((state) => state.toggleTheme)

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="app-shell">
        <header className="top-nav" role="banner">
          <div className="brand">doff</div>
          <nav aria-label="Primary">
            <ul className="nav-list">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? 'nav-link nav-link-active' : 'nav-link'
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="top-actions">
            <span className="privacy-badge">Local only • Offline-ready • No uploads</span>
            <button
              type="button"
              className="mode-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </header>
        <main id="main-content" className="workspace" role="main">
          <Outlet />
        </main>
      </div>
    </>
  )
}
