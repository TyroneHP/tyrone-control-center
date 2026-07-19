import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import type { NavigationItem } from './navigation'

export function NavigationLink({
  collapsed = false,
  item,
  onNavigate,
}: {
  collapsed?: boolean
  item: NavigationItem
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <NavLink
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx('app-navigation__link', {
          'app-navigation__link--active': isActive,
          'app-navigation__link--collapsed': collapsed,
        })
      }
      end={item.path === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      to={item.path}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  )
}
