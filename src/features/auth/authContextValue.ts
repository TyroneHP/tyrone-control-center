import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  error: string | null
  profile: Profile | null
  session: Session | null
  status: AuthStatus
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
