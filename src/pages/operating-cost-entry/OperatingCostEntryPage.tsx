import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { OperatingCostForm } from './OperatingCostForm'
import {
  calculateOperatingCosts,
  getCurrentMonth,
  initialOperatingCosts,
  type CostField,
} from './operatingCostModel'

type OperatingCostEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

type StoredOperatingEntry = {
  month: string
  costs: typeof initialOperatingCosts
}

function loadStoredOperatingEntry(): StoredOperatingEntry | null {
  try {
    const stored = window.localStorage.getItem('cost-analysis-operating-costs')
    return stored ? JSON.parse(stored) as StoredOperatingEntry : null
  } catch {
    return null
  }
}

export function OperatingCostEntryPage({ onNavigate, onAction }: OperatingCostEntryPageProps) {
  const [storedEntry] = useState(loadStoredOperatingEntry)
  const [month, setMonth] = useState(() => storedEntry?.month ?? getCurrentMonth())
  const [costs, setCosts] = useState(() => storedEntry?.costs ?? initialOperatingCosts)
  const totals = calculateOperatingCosts(costs)

  const updateCost = (field: CostField, value: string) => {
    setCosts((current) => ({ ...current, [field]: value }))
  }

  const goToNextStep = () => {
    window.localStorage.setItem(
      'cost-analysis-operating-costs',
      JSON.stringify({ month, costs, totalCost: totals.totalCost }),
    )
    onAction(`${month.replace('-', '년 ')}월 운영비를 저장했습니다.`)
    onNavigate('data-entry-3')
  }

  return (
    <div className="operating-layout">
      <Sidebar activeRoute="data-entry-2" onNavigate={onNavigate} />

      <main className="operating-page">
        <header className="operating-heading">
          <div>
            <h1>2단계: 현장 운영비</h1>
            <p>제조 공정을 위한 인건비와 운영 간접비를 입력하세요.</p>
          </div>
          <label className="operating-month-picker">
            <span className="visually-hidden">비용 기준 월</span>
            <Icon name="calendar" size={17} />
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </header>

        <OperatingCostForm
          costs={costs}
          totals={totals}
          onCostChange={updateCost}
        />

        <footer className="operating-footer">
          <button className="workflow-back-button" type="button" onClick={() => onNavigate('data-entry-1')}><Icon name="chevron-left" size={16} /> 이전 단계</button>
          <button className="workflow-coral-button" type="button" onClick={goToNextStep}>다음 단계 <Icon name="chevron-right" size={16} /></button>
        </footer>
      </main>
    </div>
  )
}
