import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { useSessionStore } from '../store/sessionStore'
import { doffTheme } from '../theme/doffTheme'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const theme = useSessionStore((state) => state.theme)

  return (
    <MantineProvider theme={doffTheme} forceColorScheme={theme}>
      {children}
    </MantineProvider>
  )
}
