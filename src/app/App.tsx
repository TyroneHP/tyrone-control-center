import { useMemo, type ComponentProps } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { AuthProvider } from '../features/auth'
import { appQueryClient } from './queryClient'
import { appRouter } from '../routes/router'
import { ReloadPrompt } from '../pwa/ReloadPrompt'
import { DevicePreferencesProvider } from '../preferences/DevicePreferencesProvider'
import { createDevicePreferenceStorage } from '../preferences/devicePreferences'

export interface AppProps {
  authClient?: SupabaseClient<Database>
  queryClient?: QueryClient
  router?: ComponentProps<typeof RouterProvider>['router']
}

export function App({
  authClient,
  queryClient = appQueryClient,
  router = appRouter,
}: AppProps) {
  const deviceStorage = useMemo(
    () => createDevicePreferenceStorage(window.localStorage),
    [],
  )

  return (
    <DevicePreferencesProvider storage={deviceStorage}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient}>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
      <ReloadPrompt />
    </DevicePreferencesProvider>
  )
}
