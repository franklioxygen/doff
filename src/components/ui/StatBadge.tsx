import type { ReactNode } from 'react'
import { Badge } from '@mantine/core'

type StatBadgeTone = 'default' | 'added' | 'removed' | 'changed'

type StatBadgeProps = {
  children: ReactNode
  tone?: StatBadgeTone
}

const toneColor: Record<StatBadgeTone, string> = {
  default: 'slate',
  added: 'moss',
  removed: 'ember',
  changed: 'amber',
}

export function StatBadge({ children, tone = 'default' }: StatBadgeProps) {
  return (
    <Badge
      size="lg"
      color={toneColor[tone]}
      variant="light"
      className="stat-badge"
      data-tone={tone}
    >
      {children}
    </Badge>
  )
}
