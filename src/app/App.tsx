import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type ComponentProps, type PropsWithChildren, useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ToastProvider, useToast } from '../design-system'
import { AuthProvider } from '../features/auth'
import type { Database } from '../lib/supabase/database.types'
import { DevicePreferencesProvider } from '../preferences/DevicePreferencesProvider'
import { createDevicePreferenceStorage } from '../preferences/devicePreferences'
import { ReloadPrompt } from '../pwa/ReloadPrompt'
import { appRouter } from '../routes/router'
import { appQueryClient } from './queryClient'

export interface AppProps {
  authClient?: SupabaseClient<Database>
  queryClient?: QueryClient
  router?: ComponentProps<typeof RouterProvider>['router']
}

function PreferenceBoundary({ children }: PropsWithChildren) {
  const toast = useToast()
  const storage = useMemo(() => {
    try {
      if (typeof window !== 'undefined') {
        return createDevicePreferenceStorage(window.localStorage)
      }
    } catch {
      // Browser privacy settings may make the localStorage getter itself throw.
    }

    return createDevicePreferenceStorage({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Storage blocked')
      },
    })
  }, [])

  return (
    <DevicePreferencesProvider
      onPersistenceError={() =>
        toast.show({
          message:
            'Die Einstellung konnte auf diesem Gerät nicht dauerhaft gespeichert werden.',
          variant: 'warning',
        })
      }
      storage={storage}
    >
      {children}
    </DevicePreferencesProvider>
  )
}

export function App({
  authClient,
  queryClient = appQueryClient,
  router = appRouter,
}: AppProps) {
  return (
    <ToastProvider>
      <PreferenceBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider client={authClient}>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
        <ReloadPrompt />
      </PreferenceBoundary>
    </ToastProvider>
  )
}
