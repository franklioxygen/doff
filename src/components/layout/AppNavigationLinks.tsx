import { NavLink } from '@mantine/core'
import {
  IconAdjustments,
  IconFileDescription,
  IconFileSpreadsheet,
  IconFolders,
  IconPhotoSpark,
  IconShieldLock,
  IconSparkles,
  IconTextSize,
} from '@tabler/icons-react'
import { NavLink as RouterNavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'

const NAV_ITEMS = [
  { labelKey: 'nav.text', to: '/text', icon: IconTextSize },
  { labelKey: 'nav.formatter', to: '/formatter', icon: IconSparkles },
  { labelKey: 'nav.images', to: '/images', icon: IconPhotoSpark },
  { labelKey: 'nav.documents', to: '/documents', icon: IconFileDescription },
  { labelKey: 'nav.spreadsheets', to: '/spreadsheets', icon: IconFileSpreadsheet },
  { labelKey: 'nav.folders', to: '/folders', icon: IconFolders },
  { labelKey: 'nav.settings', to: '/settings', icon: IconAdjustments },
  { labelKey: 'nav.aboutPrivacy', to: '/about/privacy', icon: IconShieldLock },
] as const

type AppNavigationLinksProps = {
  currentPath: string
  onNavigate?: () => void
  className?: string
}

const isActivePath = (currentPath: string, targetPath: string) =>
  currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)

export function AppNavigationLinks({
  currentPath,
  onNavigate,
  className,
}: AppNavigationLinksProps) {
  const { t } = useI18n()

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          component={RouterNavLink}
          to={item.to}
          label={t(item.labelKey)}
          leftSection={<item.icon size={16} stroke={1.8} />}
          active={isActivePath(currentPath, item.to)}
          onClick={onNavigate}
          className={className}
          variant="filled"
        />
      ))}
    </>
  )
}
