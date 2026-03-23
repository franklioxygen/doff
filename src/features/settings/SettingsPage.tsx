import { useCallback } from 'react'
import {
  useSessionStore,
  type DiffPrecision,
  type DiffViewMode,
  type TabSpaceMode,
} from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import { TEXT_LANGUAGES } from '../text/languages'
import type { SupportedLocale } from '../../i18n/config'

export function SettingsPage() {
  const theme = useSessionStore((state) => state.theme)
  const locale = useSessionStore((state) => state.locale)
  const rememberTextSession = useSessionStore((state) => state.rememberTextSession)
  const textDefaults = useSessionStore((state) => state.textDefaults)
  const textSession = useSessionStore((state) => state.textSession)
  const setTheme = useSessionStore((state) => state.setTheme)
  const setLocale = useSessionStore((state) => state.setLocale)
  const setRememberTextSession = useSessionStore((state) => state.setRememberTextSession)
  const setTextDefaults = useSessionStore((state) => state.setTextDefaults)
  const applyTextDefaultsToTextSession = useSessionStore((state) => state.applyTextDefaultsToTextSession)
  const clearTextSession = useSessionStore((state) => state.clearTextSession)
  const resetTextDefaults = useSessionStore((state) => state.resetTextDefaults)
  const resetAllLocalData = useSessionStore((state) => state.resetAllLocalData)

  const { t, locales, localeLabels, formatDateTime } = useI18n()

  const hasDraft = Boolean(
    textSession.leftText ||
      textSession.rightText ||
      textSession.leftName ||
      textSession.rightName,
  )

  const handleResetAll = useCallback(() => {
    if (window.confirm(t('settings.resetAllConfirm'))) {
      resetAllLocalData()
    }
  }, [resetAllLocalData, t])

  return (
    <section className="settings-page">
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <h2>{t('settings.appearanceTitle')}</h2>
          <p>{t('settings.appearanceDescription')}</p>
          <div className="settings-form-grid">
            <label className="settings-field">
              <span>{t('settings.themeLabel')}</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}>
                <option value="light">{t('common.light')}</option>
                <option value="dark">{t('common.dark')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.languageLabel')}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as SupportedLocale)}>
                {locales.map((entry) => (
                  <option key={entry} value={entry}>
                    {localeLabels[entry]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <h2>{t('settings.sessionTitle')}</h2>
          <p>{t('settings.sessionDescription')}</p>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={rememberTextSession}
              onChange={(event) => setRememberTextSession(event.target.checked)}
            />
            {t('settings.rememberTextSession')}
          </label>
          <p className="settings-note">{t('settings.rememberTextSessionHint')}</p>
          <div className="settings-meta">
            <div className="settings-meta-item">
              <span>{t('settings.restoreStatus')}</span>
              <strong>{rememberTextSession ? t('settings.restoreOn') : t('settings.restoreOff')}</strong>
            </div>
            <div className="settings-meta-item">
              <span>{t('settings.draftStatus')}</span>
              <strong>{hasDraft ? t('settings.draftAvailable') : t('settings.noSavedDraft')}</strong>
            </div>
            {hasDraft && (
              <div className="settings-meta-item">
                <span>{t('settings.lastUpdated')}</span>
                <strong>{formatDateTime(textSession.updatedAt)}</strong>
              </div>
            )}
          </div>
          <div className="settings-actions">
            <button type="button" onClick={applyTextDefaultsToTextSession}>
              {t('settings.applyDefaults')}
            </button>
            <button type="button" onClick={clearTextSession}>
              {t('settings.clearTextDraft')}
            </button>
            <button type="button" onClick={resetTextDefaults}>
              {t('settings.resetTextDefaults')}
            </button>
            <button type="button" className="danger-btn" onClick={handleResetAll}>
              {t('settings.resetAllLocalData')}
            </button>
          </div>
        </section>

        <section className="settings-card settings-card-wide">
          <h2>{t('settings.textDefaultsTitle')}</h2>
          <p>{t('settings.textDefaultsDescription')}</p>
          <div className="settings-form-grid settings-form-grid-wide">
            <label className="settings-field">
              <span>{t('settings.defaultViewMode')}</span>
              <select
                value={textDefaults.viewMode}
                onChange={(event) => setTextDefaults({ viewMode: event.target.value as DiffViewMode })}
              >
                <option value="split">{t('common.split')}</option>
                <option value="unified">{t('common.unified')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.defaultPrecision')}</span>
              <select
                value={textDefaults.precision}
                onChange={(event) => setTextDefaults({ precision: event.target.value as DiffPrecision })}
              >
                <option value="word">{t('common.word')}</option>
                <option value="character">{t('common.character')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.defaultSyntax')}</span>
              <select
                value={textDefaults.language}
                onChange={(event) => setTextDefaults({ language: event.target.value })}
              >
                {TEXT_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.defaultTabPolicy')}</span>
              <select
                value={textDefaults.tabSpaceMode}
                onChange={(event) => setTextDefaults({ tabSpaceMode: event.target.value as TabSpaceMode })}
              >
                <option value="none">{t('settings.noTabNormalization')}</option>
                <option value="tabsToSpaces">{t('settings.tabsToSpaces')}</option>
                <option value="spacesToTabs">{t('settings.spacesToTabs')}</option>
              </select>
            </label>
          </div>

          <div className="settings-check-grid">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.realTime}
                onChange={(event) => setTextDefaults({ realTime: event.target.checked })}
              />
              {t('settings.realTime')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.disableWrap}
                onChange={(event) => setTextDefaults({ disableWrap: event.target.checked })}
              />
              {t('settings.disableWrap')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.ignoreLeadingTrailingWhitespace}
                onChange={(event) => setTextDefaults({ ignoreLeadingTrailingWhitespace: event.target.checked })}
              />
              {t('settings.ignoreLeadingTrailingWhitespace')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.ignoreAllWhitespace}
                onChange={(event) => setTextDefaults({ ignoreAllWhitespace: event.target.checked })}
              />
              {t('settings.ignoreAllWhitespace')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.ignoreCase}
                onChange={(event) => setTextDefaults({ ignoreCase: event.target.checked })}
              />
              {t('settings.ignoreCase')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.ignoreBlankLines}
                onChange={(event) => setTextDefaults({ ignoreBlankLines: event.target.checked })}
              />
              {t('settings.ignoreBlankLines')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.trimTrailingWhitespace}
                onChange={(event) => setTextDefaults({ trimTrailingWhitespace: event.target.checked })}
              />
              {t('settings.trimTrailingWhitespace')}
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={textDefaults.normalizeUnicode}
                onChange={(event) => setTextDefaults({ normalizeUnicode: event.target.checked })}
              />
              {t('settings.normalizeUnicode')}
            </label>
          </div>
        </section>
      </div>
    </section>
  )
}
