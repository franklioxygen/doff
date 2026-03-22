import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { PlaceholderPage } from '../components/layout/PlaceholderPage'
import { TextPage } from '../features/text/TextPage'
import { ImageComparePage } from '../features/images/ImageComparePage'
import { DocumentComparePage } from '../features/documents/DocumentComparePage'

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
        element: (
          <PlaceholderPage
            title="Spreadsheet Compare"
            description="Phase 3 will add sheet-level and cell-level diffing."
          />
        ),
      },
      {
        path: 'folders',
        element: (
          <PlaceholderPage
            title="Folder Compare"
            description="Phase 3 will add directory and zip manifest comparisons."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <PlaceholderPage
            title="Settings"
            description="Global defaults, performance limits, and optional modules appear here."
          />
        ),
      },
      {
        path: 'about/privacy',
        element: (
          <PlaceholderPage
            title="About & Privacy"
            description="doff processes file contents entirely in your browser. No uploads occur."
          />
        ),
      },
      { path: '*', element: <Navigate to="/text" replace /> },
    ],
  },
])
