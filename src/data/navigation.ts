import type { IconName } from '../components/common/Icon'

export type AppRoute =
  | 'dashboard'
  | 'data-entry-1'
  | 'data-entry-2'
  | 'data-entry-3'
  | 'exchange-rate-detail'
  | 'user-management'
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
  { label: '2단계: 현장 운영비', route: 'data-entry-2' },
  { label: '3단계: 결과 확인', route: 'data-entry-3' },
]

/** 화면 라우팅용 역할. auth.ts 의 LoginRole 과 같은 값이다 */
export type RouteRole = 'admin' | 'worker'

/** 실무자가 열 수 있는 화면. 나머지는 전부 관리자 전용이다 */
export const WORKER_ROUTES: AppRoute[] = ['data-entry-1', 'data-entry-2']

/**
 * 그 역할이 이 화면을 열 수 있나.
 *
 * 사이드바를 감추는 것만으로는 부족하다 — 주소창에 `#dashboard` 를 직접 치면
 * 그대로 들어와졌다. 화면 렌더 분기가 막아주고 있었을 뿐이라, 분기가 한 번
 * 어긋나면 새어 나간다. 판정을 여기 한 곳에 모아 두고 전부 이걸 거친다.
 */
export function canOpen(route: AppRoute, role: RouteRole): boolean {
  return role === 'admin' || WORKER_ROUTES.includes(route)
}

/** 열 수 없는 화면이면 그 역할의 첫 화면으로 돌려보낸다 */
export function resolveRoute(route: AppRoute, role: RouteRole): AppRoute {
  return canOpen(route, role) ? route : 'data-entry-1'
}

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
    // 예전 인사이트 카드가 쓰던 해시. 북마크가 남아 있을 수 있어 대시보드로 보낸다
    case 'dashboard/cost-trend':
    case 'dashboard/defect-status':
      return 'dashboard'
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
