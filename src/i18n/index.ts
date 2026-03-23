import { useSessionStore } from '../store/sessionStore'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from './config'
import { TRANSLATIONS, type TranslationKey } from './translations'

type TranslationValues = Record<string, string | number>

function translateTemplate(
  locale: SupportedLocale,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const template = TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key]

  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}

export function useI18n() {
  const locale = useSessionStore((state) => state.locale)

  return {
    locale,
    locales: SUPPORTED_LOCALES,
    localeLabels: LOCALE_LABELS,
    t: (key: TranslationKey, values?: TranslationValues) => translateTemplate(locale, key, values),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...options,
      }).format(typeof value === 'string' || typeof value === 'number' ? new Date(value) : value),
  }
}
