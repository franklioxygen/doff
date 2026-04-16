import { Button, Group } from '@mantine/core'

type UploadPreviewActionsProps = {
  replaceLabel: string
  clearLabel: string
  onReplace: () => void
  onClear: () => void
}

export function UploadPreviewActions({
  replaceLabel,
  clearLabel,
  onReplace,
  onClear,
}: UploadPreviewActionsProps) {
  return (
    <Group gap="xs" className="upload-preview-actions">
      <Button type="button" variant="light" onClick={onReplace}>
        {replaceLabel}
      </Button>
      <Button type="button" variant="default" onClick={onClear}>
        {clearLabel}
      </Button>
    </Group>
  )
}
