import { QueryClient } from '@tanstack/react-query'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const appQueryClient = createAppQueryClient()
