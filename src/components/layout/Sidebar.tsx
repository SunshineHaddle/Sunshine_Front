import { dataEntrySteps, navigationItems, type AppRoute } from '../../data/navigation'
import { Icon } from '../common/Icon'
import { useSession } from '../../lib/session'

type SidebarProps = {
  activeRoute: AppRoute
  hidden?: boolean
  onNavigate: (route: AppRoute) => void
}

/** 실무자에게 열려 있는 메뉴 */
const WORKER_ROUTES: AppRoute[] = ['data-entry-1']

export function Sidebar({ activeRoute, hidden = false, onNavigate }: SidebarProps) {
  // 로그인 정보는 컨텍스트에서 받는다. 9개 페이지가 Sidebar 를 렌더하기 때문
  const session = useSession()
  const isWorker = session?.role === 'worker'

  const isInDataEntryFlow = activeRoute.startsWith('data-entry')
  const items = isWorker
    ? navigationItems.filter((item) => WORKER_ROUTES.includes(item.route))
    : navigationItems

  return (
    <aside className="sidebar" aria-label="주요 메뉴" hidden={hidden}>
      <button
        className="sidebar__brand"
        type="button"
        onClick={() => onNavigate(isWorker ? 'data-entry-1' : 'dashboard')}
      >
        해뜰종합식품
      </button>
      <nav className="sidebar__navigation">
        {items.map((item) => {
          const isActive =
            item.route === 'data-entry-1'
              ? activeRoute.startsWith('data-entry')
              : item.route === 'product-management'
                ? activeRoute.startsWith('product-')
              : item.route === 'dashboard'
                ? activeRoute === 'dashboard' || [
                    'cost-trend-detail',
                  ].includes(activeRoute)
              : item.route === activeRoute

          const navigationButton = (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`navigation-item${isActive ? ' is-active' : ''}`}
                title={item.label}
                type="button"
                onClick={() => onNavigate(item.route)}
              >
                <Icon name={item.icon} size={21} />
                <span>{item.label}</span>
              </button>
          )

          if (item.route !== 'data-entry-1') {
            return <div className="sidebar__navigation-group" key={item.label}>{navigationButton}</div>
          }

          // 실무자는 3단계(결과 확인)에 접근할 수 없으므로 단계 목록에서 뺀다
          const steps = isWorker
            ? dataEntrySteps.filter((step) => step.route !== 'data-entry-3')
            : dataEntrySteps

          return (
            <div className="sidebar__navigation-group" key={item.label}>
              {navigationButton}
              <div className="sidebar__subnavigation" aria-label="데이터 입력 단계">
                {steps.map((step) => (
                  <button
                    aria-current={activeRoute === step.route ? 'step' : undefined}
                    className={`sidebar__subnavigation-item${activeRoute === step.route ? ' is-active' : ''}`}
                    key={step.route}
                    type="button"
                    onClick={() => onNavigate(isInDataEntryFlow ? step.route : 'data-entry-1')}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {session && (
        <div className="sidebar__footer">
          <p className="sidebar__account">
            <strong>{session.userName}</strong>
            <span>{session.loginId}</span>
          </p>
          <button className="sidebar__signout navigation-item" type="button" onClick={session.signOut}>
            <Icon name="chevron-left" size={19} />
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </aside>
  )
}
