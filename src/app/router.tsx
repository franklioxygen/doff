import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { TextPage } from '../features/text/TextPage'
import { ImageComparePage } from '../features/images/ImageComparePage'
import { DocumentComparePage } from '../features/documents/DocumentComparePage'
import { SpreadsheetComparePage } from '../features/spreadsheets/SpreadsheetComparePage'
import { FolderComparePage } from '../features/folders/FolderComparePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AboutPrivacyPage } from '../features/about/AboutPrivacyPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/text" replace /> },
      { path: 'text', element: <TextPage /> },
      { path: 'images', element: <ImageComparePage /> },
      { path: 'documents', element: <DocumentComparePage /> },
      {
        path: 'spreadsheets',
        element: <SpreadsheetComparePage />,
      },
      {
        path: 'folders',
        element: <FolderComparePage />,
      },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about/privacy', element: <AboutPrivacyPage /> },
      { path: '*', element: <Navigate to="/text" replace /> },
    ],
  },
])
