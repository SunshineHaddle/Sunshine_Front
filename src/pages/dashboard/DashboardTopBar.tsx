import { Icon } from '../../components/common/Icon'

type DashboardTopBarProps = {
  searchQuery: string
  onSearch: (query: string) => void
}

export function DashboardTopBar({ searchQuery, onSearch }: DashboardTopBarProps) {
  return (
    <header className="topbar">
      <a className="topbar__brand" href="#dashboard" aria-label="Cost Analysis System 대시보드">
        Cost Analysis System
      </a>

      <label className="search-field">
        <span className="visually-hidden">공정 검색</span>
        <Icon name="search" size={20} />
        <input
          type="search"
          value={searchQuery}
          placeholder="검색..."
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
    </header>
  )
}
