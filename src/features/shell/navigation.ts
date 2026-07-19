import {
  Apple,
  Bot,
  CalendarDays,
  CheckSquare2,
  Dumbbell,
  Files,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type NavigationId =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'technician'
  | 'school'
  | 'training'
  | 'nutrition'
  | 'files'
  | 'ai'
  | 'settings'

export type PinnableNavigationId = Exclude<NavigationId, 'overview'>

export interface NavigationItem {
  id: NavigationId
  icon: LucideIcon
  label: string
  path: string
  pinnableOnMobile: boolean
}

export const defaultMobileTabs = [
  'calendar',
  'tasks',
  'training',
] as const satisfies readonly PinnableNavigationId[]

export const navigationItems: readonly NavigationItem[] = [
  {
    label: 'Übersicht',
    id: 'overview',
    path: '/',
    icon: LayoutDashboard,
    pinnableOnMobile: false,
  },
  {
    label: 'Kalender',
    id: 'calendar',
    path: '/calendar',
    icon: CalendarDays,
    pinnableOnMobile: true,
  },
  {
    label: 'Aufgaben',
    id: 'tasks',
    path: '/tasks',
    icon: CheckSquare2,
    pinnableOnMobile: true,
  },
  {
    label: 'Technikerarbeit',
    id: 'technician',
    path: '/technician',
    icon: Wrench,
    pinnableOnMobile: true,
  },
  {
    label: 'Schule',
    id: 'school',
    path: '/school',
    icon: GraduationCap,
    pinnableOnMobile: true,
  },
  {
    label: 'Training',
    id: 'training',
    path: '/training',
    icon: Dumbbell,
    pinnableOnMobile: true,
  },
  {
    label: 'Ernährung',
    id: 'nutrition',
    path: '/nutrition',
    icon: Apple,
    pinnableOnMobile: true,
  },
  {
    label: 'Dateien',
    id: 'files',
    path: '/files',
    icon: Files,
    pinnableOnMobile: true,
  },
  {
    label: 'KI-Chat',
    id: 'ai',
    path: '/ai',
    icon: Bot,
    pinnableOnMobile: true,
  },
  {
    label: 'Einstellungen',
    id: 'settings',
    path: '/settings',
    icon: Settings,
    pinnableOnMobile: true,
  },
]

export const navigationById = new Map(
  navigationItems.map((item) => [item.id, item] as const),
)

export function isPinnableNavigationId(
  value: unknown,
): value is PinnableNavigationId {
  return (
    typeof value === 'string' &&
    navigationItems.some(
      (item) => item.id === value && item.pinnableOnMobile,
    )
  )
}
