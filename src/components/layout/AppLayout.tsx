import { Suspense } from 'react'
import {
  ActionIcon,
  AppShell,
  Burger,
  Container,
  Drawer,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconMoonStars,
  IconSunHigh,
} from '@tabler/icons-react'
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useSessionStore } from '../../store/sessionStore'
import { AppNavigationLinks } from './AppNavigationLinks'
import { Footer } from './Footer'
import { PlaceholderPage } from './PlaceholderPage'

export function AppLayout() {
  const theme = useSessionStore((state) => state.theme)
  const toggleTheme = useSessionStore((state) => state.toggleTheme)
  const { t } = useI18n()
  const location = useLocation()
  const [opened, { close, toggle }] = useDisclosure(false)

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('app.skipToMain')}
      </a>
      <AppShell
        header={{ height: 92, offset: false }}
        footer={{ height: 72, offset: false }}
        padding={0}
        className="app-shell"
      >
        <AppShell.Header className="app-header" role="banner">
          <Container size={1600} h="100%" className="app-shell-container">
            <Group justify="space-between" align="center" h="100%" gap="md" wrap="nowrap">
              <Group gap="md" wrap="nowrap" className="brand-wrap">
                <div className="brand-logo-frame" aria-hidden="true">
                  <img src="/icon-192.png" alt="" className="brand-logo-img" />
                </div>
                <Stack gap={2}>
                  <Text component={RouterNavLink} to="/text" className="brand-link">
                    doff
                  </Text>
                  <Text size="xs" c="dimmed" className="brand-slogan">
                    diff offline
                  </Text>
                </Stack>
              </Group>

              <Group gap="xs" visibleFrom="sm" wrap="nowrap" aria-label={t('app.primaryNav')}>
                <AppNavigationLinks currentPath={location.pathname} className="shell-nav-link" />
              </Group>

              <Group gap="xs" wrap="nowrap">
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="moss"
                  className="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? t('app.switchToLight') : t('app.switchToDark')}
                >
                  {theme === 'dark' ? (
                    <IconSunHigh size={18} stroke={1.8} />
                  ) : (
                    <IconMoonStars size={18} stroke={1.8} />
                  )}
                </ActionIcon>
                <Burger
                  hiddenFrom="sm"
                  opened={opened}
                  onClick={toggle}
                  aria-label={t('app.primaryNav')}
                />
              </Group>
            </Group>
          </Container>
        </AppShell.Header>

        <Drawer
          opened={opened}
          onClose={close}
          title="doff"
          padding="md"
          size="sm"
          position="right"
          hiddenFrom="sm"
        >
          <Stack gap="xs">
            <AppNavigationLinks currentPath={location.pathname} onNavigate={close} />
          </Stack>
        </Drawer>

        <AppShell.Main>
          <Container size={1600} className="app-main-container">
            <main id="main-content" className="workspace">
              <Suspense
                fallback={(
                  <PlaceholderPage
                    title={t('app.loadingWorkspaceTitle')}
                    description={t('app.loadingWorkspaceBody')}
                  />
                )}
              >
                <Outlet />
              </Suspense>
            </main>
          </Container>
        </AppShell.Main>

        <AppShell.Footer className="app-footer-shell">
          <Container size={1600} className="app-shell-container">
            <Footer />
          </Container>
        </AppShell.Footer>
      </AppShell>
    </>
  )
}
