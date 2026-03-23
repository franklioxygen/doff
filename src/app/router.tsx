import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import {
  LazyAboutPrivacyPage,
  LazyDocumentComparePage,
  LazyFolderComparePage,
  LazyImageComparePage,
  LazySettingsPage,
  LazySpreadsheetComparePage,
  LazyTextPage,
} from './lazyPages'

export const router = createBrowserRouter([
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/text" replace /> },
          { path: 'text', element: <LazyTextPage /> },
          { path: 'images', element: <LazyImageComparePage /> },
          { path: 'documents', element: <LazyDocumentComparePage /> },
          {
            path: 'spreadsheets',
            element: <LazySpreadsheetComparePage />,
          },
          {
            path: 'folders',
            element: <LazyFolderComparePage />,
          },
          { path: 'settings', element: <LazySettingsPage /> },
          { path: 'about/privacy', element: <LazyAboutPrivacyPage /> },
          { path: '*', element: <Navigate to="/text" replace /> },
        ],
      },
])
