import { ExchangeRatePill } from './DashboardSummaryCharts'
import { Icon } from '../common/Icon'

type DashboardHeaderProps = {
  onExportPdf: () => void
  isExportingPdf: boolean
}

export function DashboardHeader({ onExportPdf, isExportingPdf }: DashboardHeaderProps) {
  return (
    <div className="dashboard-header" id="dashboard">
      <div>
        <h1>경영진 대시보드</h1>
        <p>제조 원가 및 운영 지표 요약</p>
      </div>
      <div className="dashboard-header__actions">
        <ExchangeRatePill />
        <button
          type="button"
          className="button button--secondary dashboard-header__export"
          onClick={onExportPdf}
          disabled={isExportingPdf}
          data-html2canvas-ignore="true"
        >
          <Icon name="download" size={18} />
          {isExportingPdf ? 'PDF 생성 중…' : 'PDF로 저장'}
        </button>
      </div>
    </div>
  )
}
