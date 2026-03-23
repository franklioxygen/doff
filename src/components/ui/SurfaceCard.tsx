import type { ReactNode } from 'react'
import { Group, Paper, Stack, Text, Title } from '@mantine/core'

type SurfaceCardProps = {
  title?: ReactNode
  description?: ReactNode
  headerAside?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  padded?: boolean
}

export function SurfaceCard({
  title,
  description,
  headerAside,
  children,
  className,
  contentClassName,
  padded = true,
}: SurfaceCardProps) {
  const hasHeader = title || description || headerAside

  return (
    <Paper withBorder className={className} p={padded ? 'lg' : 0}>
      <Stack gap={padded ? 'md' : 0} className={contentClassName}>
        {hasHeader && (
          <Group
            justify="space-between"
            align="flex-start"
            gap="md"
            wrap="wrap"
            className={!padded ? 'surface-card-header surface-card-header-compact' : 'surface-card-header'}
          >
            <Stack gap={4}>
              {typeof title === 'string' ? (
                <Title order={3} size="h4">
                  {title}
                </Title>
              ) : (
                title
              )}
              {typeof description === 'string' ? (
                <Text size="sm" c="dimmed">
                  {description}
                </Text>
              ) : (
                description
              )}
            </Stack>
            {headerAside}
          </Group>
        )}
        {children}
      </Stack>
    </Paper>
  )
}
