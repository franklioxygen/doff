import { useCallback, type ReactNode } from 'react'
import {
  Button,
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import {
  IconAdjustments,
  IconBrush,
  IconDatabase,
  IconTextPlus,
  IconTrash,
} from '@tabler/icons-react'
import {
  useSessionStore,
  type DiffPrecision,
  type DiffViewMode,
  type TabSpaceMode,
} from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import { TEXT_LANGUAGES } from '../text/languages'
import type { SupportedLocale } from '../../i18n/config'
import { PageHero } from '../../components/ui/PageHero'
import { StatBadge } from '../../components/ui/StatBadge'
import { SurfaceCard } from '../../components/ui/SurfaceCard'

type SelectOption = {
  value: string
  label: string
}

type SettingsSelectFieldProps = {
  label: string
  value: string
  data: SelectOption[]
  searchable?: boolean
  onChange: (value: string) => void
}

type SessionAction = {
  label: string
  variant: 'default' | 'light'
  color?: string
  leftSection?: ReactNode
  onClick: () => void
}

type BooleanTextDefaultKey =
  | 'realTime'
  | 'disableWrap'
  | 'ignoreLeadingTrailingWhitespace'
  | 'ignoreAllWhitespace'
  | 'ignoreCase'
  | 'ignoreBlankLines'
  | 'trimTrailingWhitespace'
  | 'normalizeUnicode'

const SettingsSelectField = ({
  label,
  value,
  data,
  searchable,
  onChange,
}: SettingsSelectFieldProps) => (
  <div>
    <Text size="sm" fw={600} mb={8}>
      {label}
    </Text>
    <Select
      searchable={searchable}
      value={value}
      data={data}
      onChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue)
        }
      }}
    />
  </div>
)

const SettingsMetaItem = ({
  label,
  value,
}: {
  label: string
  value: string
}) => (
  <div className="settings-meta-item">
    <Text size="xs" c="dimmed">{label}</Text>
    <Text fw={600}>{value}</Text>
  </div>
)

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

  const appearanceFields: SettingsSelectFieldProps[] = [
    {
      label: t('settings.themeLabel'),
      value: theme,
      onChange: (value) => {
        setTheme(value as 'light' | 'dark')
      },
      data: [
        { value: 'light', label: t('common.light') },
        { value: 'dark', label: t('common.dark') },
      ],
    },
    {
      label: t('settings.languageLabel'),
      value: locale,
      onChange: (value) => {
        setLocale(value as SupportedLocale)
      },
      data: locales.map((entry) => ({
        value: entry,
        label: localeLabels[entry],
      })),
    },
  ]

  const sessionMetaItems = [
    {
      label: t('settings.restoreStatus'),
      value: rememberTextSession ? t('settings.restoreOn') : t('settings.restoreOff'),
    },
    {
      label: t('settings.draftStatus'),
      value: hasDraft ? t('settings.draftAvailable') : t('settings.noSavedDraft'),
    },
    ...(hasDraft
      ? [{ label: t('settings.lastUpdated'), value: formatDateTime(textSession.updatedAt) }]
      : []),
  ]

  const sessionActions: SessionAction[] = [
    {
      label: t('settings.applyDefaults'),
      variant: 'light',
      onClick: applyTextDefaultsToTextSession,
    },
    {
      label: t('settings.clearTextDraft'),
      variant: 'default',
      onClick: clearTextSession,
    },
    {
      label: t('settings.resetTextDefaults'),
      variant: 'default',
      onClick: resetTextDefaults,
    },
    {
      label: t('settings.resetAllLocalData'),
      variant: 'light',
      color: 'red',
      leftSection: <IconTrash size={16} stroke={1.8} />,
      onClick: handleResetAll,
    },
  ]

  const textDefaultSelectFields: SettingsSelectFieldProps[] = [
    {
      label: t('settings.defaultViewMode'),
      value: textDefaults.viewMode,
      onChange: (value) => {
        setTextDefaults({ viewMode: value as DiffViewMode })
      },
      data: [
        { value: 'split', label: t('common.split') },
        { value: 'unified', label: t('common.unified') },
      ],
    },
    {
      label: t('settings.defaultPrecision'),
      value: textDefaults.precision,
      onChange: (value) => {
        setTextDefaults({ precision: value as DiffPrecision })
      },
      data: [
        { value: 'word', label: t('common.word') },
        { value: 'character', label: t('common.character') },
      ],
    },
    {
      label: t('settings.defaultSyntax'),
      value: textDefaults.language,
      searchable: true,
      onChange: (value) => {
        setTextDefaults({ language: value })
      },
      data: TEXT_LANGUAGES.map((language) => ({ value: language, label: language })),
    },
    {
      label: t('settings.defaultTabPolicy'),
      value: textDefaults.tabSpaceMode,
      onChange: (value) => {
        setTextDefaults({ tabSpaceMode: value as TabSpaceMode })
      },
      data: [
        { value: 'none', label: t('settings.noTabNormalization') },
        { value: 'tabsToSpaces', label: t('settings.tabsToSpaces') },
        { value: 'spacesToTabs', label: t('settings.spacesToTabs') },
      ],
    },
  ]

  const booleanTextDefaultFields: Array<{ key: BooleanTextDefaultKey; label: string }> = [
    { key: 'realTime', label: t('settings.realTime') },
    { key: 'disableWrap', label: t('settings.disableWrap') },
    { key: 'ignoreLeadingTrailingWhitespace', label: t('settings.ignoreLeadingTrailingWhitespace') },
    { key: 'ignoreAllWhitespace', label: t('settings.ignoreAllWhitespace') },
    { key: 'ignoreCase', label: t('settings.ignoreCase') },
    { key: 'ignoreBlankLines', label: t('settings.ignoreBlankLines') },
    { key: 'trimTrailingWhitespace', label: t('settings.trimTrailingWhitespace') },
    { key: 'normalizeUnicode', label: t('settings.normalizeUnicode') },
  ]

  const updateBooleanTextDefault = useCallback(
    (key: BooleanTextDefaultKey, checked: boolean) => {
      setTextDefaults({ [key]: checked } as Pick<typeof textDefaults, BooleanTextDefaultKey>)
    },
    [setTextDefaults],
  )

  return (
    <section className="settings-page">
      <Stack gap="lg">
        <PageHero
          title={t('settings.title')}
          description={t('settings.description')}
          icon={<IconAdjustments size={26} stroke={1.8} />}
          stats={(
            <>
              <StatBadge>{rememberTextSession ? t('settings.restoreOn') : t('settings.restoreOff')}</StatBadge>
              <StatBadge>{hasDraft ? t('settings.draftAvailable') : t('settings.noSavedDraft')}</StatBadge>
            </>
          )}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <SurfaceCard
            title={t('settings.appearanceTitle')}
            description={t('settings.appearanceDescription')}
            headerAside={<IconBrush size={18} stroke={1.8} />}
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {appearanceFields.map((field) => (
                <SettingsSelectField key={field.label} {...field} />
              ))}
            </SimpleGrid>
          </SurfaceCard>

          <SurfaceCard
            title={t('settings.sessionTitle')}
            description={t('settings.sessionDescription')}
            headerAside={<IconDatabase size={18} stroke={1.8} />}
          >
            <Stack gap="md">
              <Switch
                checked={rememberTextSession}
                label={t('settings.rememberTextSession')}
                onChange={(event) => setRememberTextSession(event.currentTarget.checked)}
              />
              <Text size="sm" c="dimmed">
                {t('settings.rememberTextSessionHint')}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {sessionMetaItems.map((item) => (
                  <SettingsMetaItem key={item.label} label={item.label} value={item.value} />
                ))}
              </SimpleGrid>
              <Group gap="sm" wrap="wrap">
                {sessionActions.map((action) => (
                  <Button
                    key={action.label}
                    type="button"
                    variant={action.variant}
                    color={action.color}
                    leftSection={action.leftSection}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                ))}
              </Group>
            </Stack>
          </SurfaceCard>
        </SimpleGrid>

        <SurfaceCard
          title={t('settings.textDefaultsTitle')}
          description={t('settings.textDefaultsDescription')}
          headerAside={<IconTextPlus size={18} stroke={1.8} />}
        >
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              {textDefaultSelectFields.map((field) => (
                <SettingsSelectField key={field.label} {...field} />
              ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              {booleanTextDefaultFields.map((field) => (
                <Checkbox
                  key={field.key}
                  checked={textDefaults[field.key]}
                  label={field.label}
                  onChange={(event) => {
                    updateBooleanTextDefault(field.key, event.currentTarget.checked)
                  }}
                />
              ))}
            </SimpleGrid>
          </Stack>
        </SurfaceCard>
      </Stack>
    </section>
  )
}
