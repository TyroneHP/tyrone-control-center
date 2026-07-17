import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingIndicator } from '../../design-system'
import { useAuth } from './authContextValue'

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const { profile, status } = useAuth()

  if (status === 'loading') {
    return <LoadingIndicator label="Sitzung wird geprüft …" />
  }

  if (status !== 'authenticated' || profile?.status !== 'active') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return children ?? <Outlet />
}
