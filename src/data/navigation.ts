import type { IconName } from '../components/common/Icon'

export type AppRoute =
  | 'dashboard'
  | 'data-entry-1'
  | 'data-entry-2'
  | 'data-entry-3'

export type NavigationDefinition = {
  label: string
  icon: IconName
  route: AppRoute
}

export const navigationItems: NavigationDefinition[] = [
  { label: 'Dashboard', icon: 'dashboard', route: 'dashboard' },
  { label: 'Data Entry', icon: 'data', route: 'data-entry-1' },
]

export function routeFromHash(hash: string): AppRoute {
  switch (hash.replace(/^#/, '')) {
    case 'data-entry/1':
      return 'data-entry-1'
    case 'data-entry/2':
      return 'data-entry-2'
    case 'data-entry/3':
      return 'data-entry-3'
    default:
      return 'dashboard'
  }
}

export function hashForRoute(route: AppRoute) {
  switch (route) {
    case 'data-entry-1':
      return '#data-entry/1'
    case 'data-entry-2':
      return '#data-entry/2'
    case 'data-entry-3':
      return '#data-entry/3'
    default:
      return '#dashboard'
  }
}
