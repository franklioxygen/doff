import { useCallback } from 'react'
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

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <SurfaceCard
            title={t('settings.appearanceTitle')}
            description={t('settings.appearanceDescription')}
            headerAside={<IconBrush size={18} stroke={1.8} />}
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.themeLabel')}
                </Text>
                <Select
                  value={theme}
                  onChange={(value) => value && setTheme(value as 'light' | 'dark')}
                  data={[
                    { value: 'light', label: t('common.light') },
                    { value: 'dark', label: t('common.dark') },
                  ]}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.languageLabel')}
                </Text>
                <Select
                  value={locale}
                  onChange={(value) => value && setLocale(value as SupportedLocale)}
                  data={locales.map((entry) => ({
                    value: entry,
                    label: localeLabels[entry],
                  }))}
                />
              </div>
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
                <div className="settings-meta-item">
                  <Text size="xs" c="dimmed">{t('settings.restoreStatus')}</Text>
                  <Text fw={600}>{rememberTextSession ? t('settings.restoreOn') : t('settings.restoreOff')}</Text>
                </div>
                <div className="settings-meta-item">
                  <Text size="xs" c="dimmed">{t('settings.draftStatus')}</Text>
                  <Text fw={600}>{hasDraft ? t('settings.draftAvailable') : t('settings.noSavedDraft')}</Text>
                </div>
                {hasDraft && (
                  <div className="settings-meta-item">
                    <Text size="xs" c="dimmed">{t('settings.lastUpdated')}</Text>
                    <Text fw={600}>{formatDateTime(textSession.updatedAt)}</Text>
                  </div>
                )}
              </SimpleGrid>
              <Group gap="sm" wrap="wrap">
                <Button type="button" variant="light" onClick={applyTextDefaultsToTextSession}>
                  {t('settings.applyDefaults')}
                </Button>
                <Button type="button" variant="default" onClick={clearTextSession}>
                  {t('settings.clearTextDraft')}
                </Button>
                <Button type="button" variant="default" onClick={resetTextDefaults}>
                  {t('settings.resetTextDefaults')}
                </Button>
                <Button
                  type="button"
                  color="red"
                  variant="light"
                  leftSection={<IconTrash size={16} stroke={1.8} />}
                  onClick={handleResetAll}
                >
                  {t('settings.resetAllLocalData')}
                </Button>
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
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultViewMode')}
                </Text>
                <Select
                  value={textDefaults.viewMode}
                  onChange={(value) => value && setTextDefaults({ viewMode: value as DiffViewMode })}
                  data={[
                    { value: 'split', label: t('common.split') },
                    { value: 'unified', label: t('common.unified') },
                  ]}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultPrecision')}
                </Text>
                <Select
                  value={textDefaults.precision}
                  onChange={(value) => value && setTextDefaults({ precision: value as DiffPrecision })}
                  data={[
                    { value: 'word', label: t('common.word') },
                    { value: 'character', label: t('common.character') },
                  ]}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultSyntax')}
                </Text>
                <Select
                  searchable
                  value={textDefaults.language}
                  onChange={(value) => value && setTextDefaults({ language: value })}
                  data={TEXT_LANGUAGES.map((language) => ({ value: language, label: language }))}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultTabPolicy')}
                </Text>
                <Select
                  value={textDefaults.tabSpaceMode}
                  onChange={(value) => value && setTextDefaults({ tabSpaceMode: value as TabSpaceMode })}
                  data={[
                    { value: 'none', label: t('settings.noTabNormalization') },
                    { value: 'tabsToSpaces', label: t('settings.tabsToSpaces') },
                    { value: 'spacesToTabs', label: t('settings.spacesToTabs') },
                  ]}
                />
              </div>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              <Checkbox
                checked={textDefaults.realTime}
                label={t('settings.realTime')}
                onChange={(event) => setTextDefaults({ realTime: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.disableWrap}
                label={t('settings.disableWrap')}
                onChange={(event) => setTextDefaults({ disableWrap: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.ignoreLeadingTrailingWhitespace}
                label={t('settings.ignoreLeadingTrailingWhitespace')}
                onChange={(event) => setTextDefaults({ ignoreLeadingTrailingWhitespace: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.ignoreAllWhitespace}
                label={t('settings.ignoreAllWhitespace')}
                onChange={(event) => setTextDefaults({ ignoreAllWhitespace: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.ignoreCase}
                label={t('settings.ignoreCase')}
                onChange={(event) => setTextDefaults({ ignoreCase: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.ignoreBlankLines}
                label={t('settings.ignoreBlankLines')}
                onChange={(event) => setTextDefaults({ ignoreBlankLines: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.trimTrailingWhitespace}
                label={t('settings.trimTrailingWhitespace')}
                onChange={(event) => setTextDefaults({ trimTrailingWhitespace: event.currentTarget.checked })}
              />
              <Checkbox
                checked={textDefaults.normalizeUnicode}
                label={t('settings.normalizeUnicode')}
                onChange={(event) => setTextDefaults({ normalizeUnicode: event.currentTarget.checked })}
              />
            </SimpleGrid>
          </Stack>
        </SurfaceCard>
      </Stack>
    </section>
  )
}
