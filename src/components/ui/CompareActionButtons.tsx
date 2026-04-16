import { ActionIcon, Group } from '@mantine/core'
import { IconArrowsLeftRight, IconTrash } from '@tabler/icons-react'

type CompareActionButtonsProps = {
  onSwap: () => void
  onClear: () => void
  swapDisabled: boolean
  clearDisabled: boolean
  swapTitle: string
  clearTitle: string
}

export function CompareActionButtons({
  onSwap,
  onClear,
  swapDisabled,
  clearDisabled,
  swapTitle,
  clearTitle,
}: CompareActionButtonsProps) {
  return (
    <Group gap="xs">
      <ActionIcon
        type="button"
        size="lg"
        variant="light"
        onClick={onSwap}
        disabled={swapDisabled}
        title={swapTitle}
      >
        <IconArrowsLeftRight size={18} stroke={1.8} />
      </ActionIcon>
      <ActionIcon
        type="button"
        size="lg"
        variant="default"
        onClick={onClear}
        disabled={clearDisabled}
        title={clearTitle}
      >
        <IconTrash size={18} stroke={1.8} />
      </ActionIcon>
    </Group>
  )
}
