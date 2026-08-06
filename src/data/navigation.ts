import type { IconName } from '../components/common/Icon'

export type AppRoute =
  | 'dashboard'
  | 'data-entry-1'
  | 'data-entry-2'
  | 'data-entry-3'
  | 'exchange-rate-detail'
  | 'user-management'
  | 'cost-trend-detail'
  | 'defect-status-detail'
  | 'product-management'
  | 'product-create'
  | 'product-detail'

export type NavigationDefinition = {
  label: string
  icon: IconName
  route: AppRoute
}

export type DataEntryStep = {
  label: string
  route: Extract<AppRoute, 'data-entry-1' | 'data-entry-2' | 'data-entry-3'>
}

export const navigationItems: NavigationDefinition[] = [
  { label: '대시보드', icon: 'dashboard', route: 'dashboard' },
  { label: '제품 관리', icon: 'box', route: 'product-management' },
  { label: '데이터 입력', icon: 'data', route: 'data-entry-1' },
  { label: '환율 산출', icon: 'exchange', route: 'exchange-rate-detail' },
  { label: '사용자 관리', icon: 'users', route: 'user-management' },
]

export const dataEntrySteps: DataEntryStep[] = [
  { label: '1단계: 재료비', route: 'data-entry-1' },
  { label: '2단계: 운영비', route: 'data-entry-2' },
  { label: '3단계: 결과 확인', route: 'data-entry-3' },
]

export function routeFromHash(hash: string): AppRoute {
  switch (hash.replace(/^#/, '')) {
    case 'data-entry/1':
      return 'data-entry-1'
    case 'data-entry/2':
      return 'data-entry-2'
    case 'data-entry/3':
      return 'data-entry-3'
    case 'dashboard/exchange-rate':
      return 'exchange-rate-detail'
    case 'users':
      return 'user-management'
    case 'dashboard/cost-trend':
      return 'dashboard'
    case 'dashboard/defect-status':
      return 'defect-status-detail'
    case 'products':
      return 'product-management'
    case 'products/new':
      return 'product-create'
    case 'products/detail':
      return 'product-detail'
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
    case 'exchange-rate-detail':
      return '#dashboard/exchange-rate'
    case 'user-management':
      return '#users'
    case 'cost-trend-detail':
      return '#dashboard'
    case 'defect-status-detail':
      return '#dashboard/defect-status'
    case 'product-management':
      return '#products'
    case 'product-create':
      return '#products/new'
    case 'product-detail':
      return '#products/detail'
    default:
      return '#dashboard'
  }
}
