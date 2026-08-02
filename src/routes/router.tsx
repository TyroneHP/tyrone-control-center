import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'
import {
  ForgotPasswordPage,
  LoginPage,
  ProtectedRoute,
  SetupPage,
  UpdatePasswordPage,
} from '../features/auth'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { TrainingDemoLayout } from '../features/training/components/TrainingDemoLayout'
import { TrainingActiveSessionPage } from '../features/training/pages/TrainingActiveSessionPage'
import { TrainingDashboardPage } from '../features/training/pages/TrainingDashboardPage'
import { TrainingExerciseLibraryPage } from '../features/training/pages/TrainingExerciseLibraryPage'
import { TrainingPlanDetailPage } from '../features/training/pages/TrainingPlanDetailPage'
import { TrainingPlanWizardPage } from '../features/training/pages/TrainingPlanWizardPage'
import { PlaceholderPage } from './PlaceholderPage'
import { ProtectedShell } from './ProtectedShell'
import { SettingsRoute } from './SettingsRoute'

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
          {
            path: 'training',
            element: <TrainingDemoLayout />,
            children: [
              { index: true, element: <TrainingDashboardPage /> },
              { path: 'plans/new', element: <TrainingPlanWizardPage /> },
              { path: 'plans/:planId', element: <TrainingPlanDetailPage /> },
              { path: 'library', element: <TrainingExerciseLibraryPage /> },
              { path: 'active', element: <TrainingActiveSessionPage /> },
              { path: '*', element: <Navigate replace to="/training" /> },
            ],
          },
          { path: 'nutrition', element: <PlaceholderPage title="Ernährung" /> },
          { path: 'files', element: <PlaceholderPage title="Dateien" /> },
          { path: 'ai', element: <PlaceholderPage title="KI-Chat" /> },
          {
            path: 'settings',
            element: <SettingsRoute />,
          },
        ],
      },
    ],
  },
]

export const appRouter = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL,
})
