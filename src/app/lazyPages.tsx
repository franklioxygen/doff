import { lazy } from 'react'

export const LazyTextPage = lazy(() =>
  import('../features/text/TextPage').then((module) => ({ default: module.TextPage })),
)

export const LazyImageComparePage = lazy(() =>
  import('../features/images/ImageComparePage').then((module) => ({ default: module.ImageComparePage })),
)

export const LazyDocumentComparePage = lazy(() =>
  import('../features/documents/DocumentComparePage').then((module) => ({ default: module.DocumentComparePage })),
)

export const LazySpreadsheetComparePage = lazy(() =>
  import('../features/spreadsheets/SpreadsheetComparePage').then((module) => ({ default: module.SpreadsheetComparePage })),
)

export const LazyFolderComparePage = lazy(() =>
  import('../features/folders/FolderComparePage').then((module) => ({ default: module.FolderComparePage })),
)

export const LazySettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)

export const LazyAboutPrivacyPage = lazy(() =>
  import('../features/about/AboutPrivacyPage').then((module) => ({ default: module.AboutPrivacyPage })),
)
