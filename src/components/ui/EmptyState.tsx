import type { ReactNode } from 'react'
import { Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Paper withBorder p="xl" className="empty-state-card">
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" variant="light" color="moss">
          {icon}
        </ThemeIcon>
        <Stack gap={6} align="center">
          <Title order={3}>{title}</Title>
          <Text c="dimmed" ta="center" maw={540}>
            {description}
          </Text>
        </Stack>
        {action && <Group>{action}</Group>}
      </Stack>
    </Paper>
  )
}
