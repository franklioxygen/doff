export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'zh'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
}

export function resolveSupportedLocale(input?: string | null): SupportedLocale {
  if (!input) {
    return 'en'
  }

  const normalized = input.toLowerCase()

  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('fr')) return 'fr'
  if (normalized.startsWith('de')) return 'de'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('zh')) return 'zh'

  return 'en'
}

export function getPreferredLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  return resolveSupportedLocale(navigator.language)
}
