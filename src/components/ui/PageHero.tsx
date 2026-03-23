import type { ReactNode } from 'react'
import { Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'

type PageHeroProps = {
  title: string
  description?: string
  icon?: ReactNode
  stats?: ReactNode
  actions?: ReactNode
}

export function PageHero({ title, description, icon, stats, actions }: PageHeroProps) {
  return (
    <Paper className="page-hero" p="lg" withBorder>
      <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
        <Group align="flex-start" gap="md" wrap="nowrap" className="page-hero-intro">
          {icon && (
            <ThemeIcon size={52} radius="xl" variant="light" color="moss" className="page-hero-icon">
              {icon}
            </ThemeIcon>
          )}
          <Stack gap={6}>
            <Title order={1} className="page-hero-title">
              {title}
            </Title>
            {description && (
              <Text c="dimmed" maw={760} className="page-hero-description">
                {description}
              </Text>
            )}
            {stats && (
              <Group gap="xs" wrap="wrap" mt="xs">
                {stats}
              </Group>
            )}
          </Stack>
        </Group>
        {actions && (
          <Group gap="xs" wrap="wrap" className="page-hero-actions">
            {actions}
          </Group>
        )}
      </Group>
    </Paper>
  )
}
