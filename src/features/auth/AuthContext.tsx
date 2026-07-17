import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/database.types'
import { getSupabaseClient } from '../../lib/supabase/client'
import {
  AuthContext,
  type AuthStatus,
  type Profile,
} from './authContextValue'

export interface AuthProviderProps {
  children: ReactNode
  client?: SupabaseClient<Database>
}

const profileCachePrefix = 'tyrone-control-center:active-profile:'

function cacheKey(userId: string) {
  return `${profileCachePrefix}${userId}`
}

function readCachedProfile(userId: string): Profile | null {
  try {
    const value = localStorage.getItem(cacheKey(userId))
    if (!value) return null
    const profile = JSON.parse(value) as Profile
    return profile.id === userId && profile.status === 'active' ? profile : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: Profile) {
  try {
    localStorage.setItem(cacheKey(profile.id), JSON.stringify(profile))
  } catch {
    // The verified online profile remains usable if browser storage is unavailable.
  }
}

function removeCachedProfiles(userId?: string) {
  try {
    if (userId) {
      localStorage.removeItem(cacheKey(userId))
      return
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(profileCachePrefix)) localStorage.removeItem(key)
    }
  } catch {
    // Session state still remains authoritative when browser storage is unavailable.
  }
}

export function AuthProvider({ children, client }: AuthProviderProps) {
  const supabase = client ?? getSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const acceptedProfiles = useRef(new Map<string, Profile>())

  useEffect(() => {
    let active = true

    async function synchronize(nextSession: Session | null) {
      if (!active) return
      setError(null)

      if (!nextSession) {
        removeCachedProfiles()
        setSession(null)
        setProfile(null)
        setStatus('unauthenticated')
        return
      }

      setSession(nextSession)
      setStatus('loading')

      const { data: loadedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .single()

      if (!active) return
      if (profileError || !loadedProfile) {
        const cachedProfile =
          navigator.onLine === false
            ? readCachedProfile(nextSession.user.id)
            : null
        if (cachedProfile) {
          setProfile(cachedProfile)
          setError('Offline-Modus: Es werden zuletzt bestätigte Kontodaten verwendet.')
          setStatus('authenticated')
          return
        }
        await supabase.auth.signOut({ scope: 'local' })
        if (!active) return
        removeCachedProfiles(nextSession.user.id)
        setSession(null)
        setProfile(null)
        setError('Das Benutzerprofil konnte nicht geladen werden.')
        setStatus('unauthenticated')
        return
      }

      let authorizedProfile = loadedProfile
      if (loadedProfile.status === 'invited') {
        const acceptedProfile = acceptedProfiles.current.get(loadedProfile.id)
        if (acceptedProfile) {
          authorizedProfile = acceptedProfile
        } else {
          const { data, error: acceptanceError } = await supabase.rpc(
            'accept_current_invitation',
          )
          if (!active) return
          if (acceptanceError || !data) {
            await supabase.auth.signOut({ scope: 'local' })
            if (!active) return
            removeCachedProfiles(nextSession.user.id)
            setSession(null)
            setProfile(null)
            setError('Die Einladung ist ungültig oder abgelaufen.')
            setStatus('unauthenticated')
            return
          }
          acceptedProfiles.current.set(data.id, data)
          authorizedProfile = data
        }
      }

      if (authorizedProfile.status !== 'active') {
        await supabase.auth.signOut({ scope: 'local' })
        if (!active) return
        removeCachedProfiles(nextSession.user.id)
        setSession(null)
        setProfile(null)
        setError('Dieses Benutzerkonto ist deaktiviert.')
        setStatus('unauthenticated')
        return
      }

      writeCachedProfile(authorizedProfile)
      setProfile(authorizedProfile)
      setStatus('authenticated')
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        if (!active) return
        setError('Die Sitzung konnte nicht geladen werden.')
        setStatus('unauthenticated')
        return
      }
      void synchronize(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void synchronize(nextSession)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(
    () => ({ error, profile, session, status }),
    [error, profile, session, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
