import { NavLink, Outlet } from 'react-router-dom'

const ITEMS = [
  { label: 'Dashboard', to: '/training/progress', end: true },
  { label: 'Übungen', to: '/training/progress/exercises', end: false },
  { label: 'Rekorde', to: '/training/progress/records', end: false },
  { label: 'Muskelgruppen', to: '/training/progress/muscles', end: false },
  { label: 'Körpergewicht', to: '/training/progress/bodyweight', end: false },
] as const

export function ProgressNavigation() {
  return (
    <nav aria-label="Fortschrittsbereiche" className="progress-navigation">
      <ul>
        {ITEMS.map(({ end, label, to }) => (
          <li key={to}>
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? 'progress-navigation__link is-active'
                  : 'progress-navigation__link'
              }
              end={end}
              to={to}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ProgressLayout() {
  return (
    <div className="progress-layout">
      <ProgressNavigation />
      <Outlet />
    </div>
  )
}
