import { navigationItems, type AppRoute } from '../../data/navigation'
import { Icon } from '../common/Icon'

type SidebarProps = {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
}

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      <nav className="sidebar__navigation">
        {navigationItems.map((item) => {
          const isActive =
            item.route === 'data-entry-1'
              ? activeRoute.startsWith('data-entry')
              : item.route === activeRoute

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`navigation-item${isActive ? ' is-active' : ''}`}
              key={item.label}
              title={item.label}
              type="button"
              onClick={() => onNavigate(item.route)}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
