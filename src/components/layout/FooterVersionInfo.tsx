import { Badge, Group, Text, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  CURRENT_VERSION,
  fetchLatestGithubVersion,
  getBuildDateLabel,
  isNewerVersion,
  readVersionCheckCache,
  type UpdateInfo,
  writeVersionCheckCache,
} from './footerVersionInfoUtils'

export function FooterVersionInfo() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(() => {
    const cachedResult = readVersionCheckCache()
    return cachedResult?.hasUpdate ? {
      latestVersion: cachedResult.latestVersion,
      releaseUrl: cachedResult.releaseUrl,
    } : null
  })

  useEffect(() => {
    const cachedResult = readVersionCheckCache()
    if (cachedResult) return

    const abortController = new AbortController()
    let isActive = true

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const latestVersion = await fetchLatestGithubVersion(abortController.signal)
          const hasUpdate = Boolean(
            latestVersion?.releaseUrl
            && isNewerVersion(latestVersion.latestVersion, CURRENT_VERSION),
          )

          writeVersionCheckCache({
            checkedAt: Date.now(),
            latestVersion: latestVersion?.latestVersion ?? CURRENT_VERSION,
            releaseUrl: latestVersion?.releaseUrl ?? '',
            hasUpdate,
          })

          if (!isActive) return
          setUpdateInfo(hasUpdate && latestVersion ? latestVersion : null)
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.debug('Failed to check latest doff version', error)
          }
        }
      })()
    }, 160)

    return () => {
      isActive = false
      abortController.abort()
      window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <Group gap={6} wrap="wrap" className="footer-version-group">
      <Tooltip label={getBuildDateLabel()} withArrow>
        <Text size="sm" className="footer-version">
          v{CURRENT_VERSION}
        </Text>
      </Tooltip>
      {updateInfo && (
        <Tooltip label={`New version available: v${updateInfo.latestVersion}`} withArrow>
          <Badge
            component="a"
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            color="green"
            variant="light"
            radius="xl"
            size="xs"
            className="footer-update-chip"
          >
            Update
          </Badge>
        </Tooltip>
      )}
    </Group>
  )
}
