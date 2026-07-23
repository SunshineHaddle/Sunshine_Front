import { Icon } from '../common/Icon'

type DashboardHeaderProps = {
  onDownload: () => void
}

export function DashboardHeader({ onDownload }: DashboardHeaderProps) {
  return (
    <div className="dashboard-header" id="dashboard">
      <div>
        <h1>경영진 대시보드</h1>
        <p>제조 원가 및 운영 지표 요약</p>
      </div>

      <div className="dashboard-header__actions">
        <button className="button button--primary" type="button" onClick={onDownload}>
          <Icon name="download" size={17} />
          <span>보고서 다운로드</span>
        </button>
      </div>
    </div>
  )
}
