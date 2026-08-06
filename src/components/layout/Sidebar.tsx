import { dataEntrySteps, navigationItems, type AppRoute } from '../../data/navigation'
import { Icon } from '../common/Icon'

type SidebarProps = {
  activeRoute: AppRoute
  hidden?: boolean
  onNavigate: (route: AppRoute) => void
}

export function Sidebar({ activeRoute, hidden = false, onNavigate }: SidebarProps) {
  const isInDataEntryFlow = activeRoute.startsWith('data-entry')

  return (
    <aside className="sidebar" aria-label="주요 메뉴" hidden={hidden}>
      <button
        className="sidebar__brand"
        type="button"
        onClick={() => onNavigate('dashboard')}
      >
        햇뜰종합식품
      </button>
      <nav className="sidebar__navigation">
        {navigationItems.map((item) => {
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

          return (
            <div className="sidebar__navigation-group" key={item.label}>
              {navigationButton}
              <div className="sidebar__subnavigation" aria-label="데이터 입력 단계">
                {dataEntrySteps.map((step) => (
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
    </aside>
  )
}
