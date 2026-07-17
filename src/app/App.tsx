import type { ComponentProps } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import { AuthProvider } from '../features/auth'
import { appQueryClient } from './queryClient'
import { appRouter } from '../routes/router'
import { ReloadPrompt } from '../pwa/ReloadPrompt'

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
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient}>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
      <ReloadPrompt />
    </>
  )
}
