import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import {
  ForgotPasswordPage,
  LoginPage,
  ProtectedRoute,
  SetupPage,
  UpdatePasswordPage,
} from '../features/auth'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { PlaceholderPage } from './PlaceholderPage'
import { ProtectedShell } from './ProtectedShell'

export const appRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/update-password', element: <UpdatePasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ProtectedShell />,
        children: [
          { index: true, element: <PlaceholderPage title="Übersicht" /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'tasks', element: <PlaceholderPage title="Aufgaben" /> },
          {
            path: 'technician',
            element: <PlaceholderPage title="Technikerarbeit" />,
          },
          { path: 'school', element: <PlaceholderPage title="Schule" /> },
          { path: 'training', element: <PlaceholderPage title="Training" /> },
          { path: 'nutrition', element: <PlaceholderPage title="Ernährung" /> },
          { path: 'files', element: <PlaceholderPage title="Dateien" /> },
          { path: 'ai', element: <PlaceholderPage title="KI-Chat" /> },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]

export const appRouter = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL,
})
