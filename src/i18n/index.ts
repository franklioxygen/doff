import { useMemo } from 'react'
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
  const formatters = useMemo(() => {
    const numberFormatterCache = new Map<string, Intl.NumberFormat>()
    const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

    const getNumberFormatter = (options?: Intl.NumberFormatOptions) => {
      const key = JSON.stringify(options ?? {})
      let formatter = numberFormatterCache.get(key)

      if (!formatter) {
        formatter = new Intl.NumberFormat(locale, options)
        numberFormatterCache.set(key, formatter)
      }

      return formatter
    }

    const getDateTimeFormatter = (options?: Intl.DateTimeFormatOptions) => {
      const normalizedOptions = {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...options,
      } as Intl.DateTimeFormatOptions
      const key = JSON.stringify(normalizedOptions)
      let formatter = dateTimeFormatterCache.get(key)

      if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, normalizedOptions)
        dateTimeFormatterCache.set(key, formatter)
      }

      return formatter
    }

    return {
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        getNumberFormatter(options).format(value),
      formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
        getDateTimeFormatter(options).format(
          typeof value === 'string' || typeof value === 'number' ? new Date(value) : value,
        ),
    }
  }, [locale])

  return useMemo(() => {
    
    return {
      locale,
      locales: SUPPORTED_LOCALES,
      localeLabels: LOCALE_LABELS,
      t: (key: TranslationKey, values?: TranslationValues) => translateTemplate(locale, key, values),
      formatNumber: formatters.formatNumber,
      formatDateTime: formatters.formatDateTime,
    }
  }, [formatters, locale])
}
