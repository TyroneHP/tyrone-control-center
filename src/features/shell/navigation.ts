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

export interface NavigationItem {
  icon: LucideIcon
  label: string
  mobilePrimary: boolean
  path: string
}

export const navigationItems: readonly NavigationItem[] = [
  {
    label: 'Übersicht',
    path: '/',
    icon: LayoutDashboard,
    mobilePrimary: true,
  },
  {
    label: 'Kalender',
    path: '/calendar',
    icon: CalendarDays,
    mobilePrimary: true,
  },
  {
    label: 'Aufgaben',
    path: '/tasks',
    icon: CheckSquare2,
    mobilePrimary: true,
  },
  {
    label: 'Technikerarbeit',
    path: '/technician',
    icon: Wrench,
    mobilePrimary: false,
  },
  {
    label: 'Schule',
    path: '/school',
    icon: GraduationCap,
    mobilePrimary: false,
  },
  {
    label: 'Training',
    path: '/training',
    icon: Dumbbell,
    mobilePrimary: false,
  },
  {
    label: 'Ernährung',
    path: '/nutrition',
    icon: Apple,
    mobilePrimary: false,
  },
  {
    label: 'Dateien',
    path: '/files',
    icon: Files,
    mobilePrimary: false,
  },
  {
    label: 'KI-Chat',
    path: '/ai',
    icon: Bot,
    mobilePrimary: false,
  },
  {
    label: 'Einstellungen',
    path: '/settings',
    icon: Settings,
    mobilePrimary: true,
  },
]
