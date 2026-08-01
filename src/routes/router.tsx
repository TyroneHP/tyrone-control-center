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
import { ActiveWorkoutPage } from '../features/training/pages/ActiveWorkoutPage'
import { BodyWeightPage } from '../features/training/pages/BodyWeightPage'
import { CompletedWorkoutPage } from '../features/training/pages/CompletedWorkoutPage'
import { ExerciseAnalyticsPage } from '../features/training/pages/ExerciseAnalyticsPage'
import { ExerciseLibraryPage } from '../features/training/pages/ExerciseLibraryPage'
import { MuscleGroupAnalyticsPage } from '../features/training/pages/MuscleGroupAnalyticsPage'
import { ProgressDashboardPage } from '../features/training/pages/ProgressDashboardPage'
import { RecordAnalyticsPage } from '../features/training/pages/RecordAnalyticsPage'
import { TrainingHomePage } from '../features/training/pages/TrainingHomePage'
import { WorkoutHistoryPage } from '../features/training/pages/WorkoutHistoryPage'
import { WorkoutTemplateEditorPage } from '../features/training/pages/WorkoutTemplateEditorPage'
import { ProgressLayout } from '../features/training/components/ProgressNavigation'
import { TrainingLayout } from '../features/training/components/TrainingNavigation'
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
          {
            path: 'training',
            element: <TrainingLayout />,
            children: [
              { index: true, element: <TrainingHomePage /> },
              { path: 'library', element: <ExerciseLibraryPage /> },
              {
                path: 'templates/new',
                element: <WorkoutTemplateEditorPage />,
              },
              {
                path: 'templates/:templateId/edit',
                element: <WorkoutTemplateEditorPage />,
              },
              { path: 'active', element: <ActiveWorkoutPage /> },
              { path: 'history', element: <WorkoutHistoryPage /> },
              {
                path: 'history/:workoutId',
                element: <CompletedWorkoutPage />,
              },
              {
                path: 'progress',
                element: <ProgressLayout />,
                children: [
                  { index: true, element: <ProgressDashboardPage /> },
                  { path: 'exercises', element: <ExerciseAnalyticsPage /> },
                  { path: 'records', element: <RecordAnalyticsPage /> },
                  { path: 'muscles', element: <MuscleGroupAnalyticsPage /> },
                  { path: 'bodyweight', element: <BodyWeightPage /> },
                ],
              },
            ],
          },
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
