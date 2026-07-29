import { Link, Outlet, useLocation } from 'react-router-dom'

const ITEMS = [
  { label: 'Übersicht', to: '/training' },
  { label: 'Pläne', to: '/training#training-templates-heading' },
  { label: 'Bibliothek', to: '/training/library' },
  { label: 'Verlauf', to: '/training/history' },
  { label: 'Fortschritt', to: '/training/progress' },
] as const

function isCurrent(pathname: string, hash: string, label: string) {
  if (label === 'Übersicht') return pathname === '/training' && hash === ''
  if (label === 'Pläne') {
    return (
      pathname.startsWith('/training/templates') ||
      (pathname === '/training' && hash === '#training-templates-heading')
    )
  }
  if (label === 'Bibliothek') return pathname.startsWith('/training/library')
  if (label === 'Verlauf') return pathname.startsWith('/training/history')
  return pathname.startsWith('/training/progress')
}

export function TrainingNavigation() {
  const { hash, pathname } = useLocation()
  return (
    <nav aria-label="Trainingsbereiche" className="training-navigation">
      <ul>
        {ITEMS.map(({ label, to }) => {
          const current = isCurrent(pathname, hash, label)
          return (
            <li key={label}>
              <Link
                aria-current={current ? 'page' : undefined}
                className={current ? 'training-navigation__link is-active' : 'training-navigation__link'}
                to={to}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function TrainingLayout() {
  return (
    <div className="training-layout">
      <TrainingNavigation />
      <Outlet />
    </div>
  )
}
