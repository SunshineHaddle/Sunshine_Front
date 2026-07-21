import { useState } from 'react'
import { Icon, type IconName } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import { WorkflowStepper } from '../../components/workflow/WorkflowStepper'
import type { AppRoute } from '../../data/navigation'

type OperatingCostEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

type CostItem = {
  id: number
  name: string
  description: string
  type: string
  icon: IconName
  unitCost: number
  quantity: number
}

const initialCosts: CostItem[] = []

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value)

export function OperatingCostEntryPage({ onNavigate, onAction }: OperatingCostEntryPageProps) {
  const [costs, setCosts] = useState(initialCosts)

  const total = costs.reduce((sum, item) => sum + item.unitCost * item.quantity, 0)

  const updateCost = (id: number, key: 'unitCost' | 'quantity', value: number) => {
    setCosts((current) => current.map((item) => item.id === id ? { ...item, [key]: Math.max(0, value) } : item))
  }

  const addCost = () => {
    setCosts((current) => [
      ...current,
      {
        id: Date.now(),
        name: '신규 운영비',
        description: '세부 항목을 입력하세요',
        type: '기타제조간접비',
        icon: 'calculator',
        unitCost: 0,
        quantity: 0,
      },
    ])
    onAction('새 운영비 항목을 추가했습니다.')
  }

  return (
    <div className="operating-layout">
      <Sidebar activeRoute="data-entry-2" onNavigate={onNavigate} />

      <div className="operating-shell">
        <header className="workflow-topbar">
          <strong>CostAnalysis</strong>
        </header>
        <main className="operating-page">
          <header className="operating-heading">
            <h1>데이터 입력 2단계: 운영비</h1>
            <p>인건비, 유틸리티, 고정비 등 운영에 필요한 비용을 입력해주세요.</p>
          </header>

          <WorkflowStepper activeStep={2} labels={['자재비', '운영비', '결과 확인']} />

          <section className="operating-card" aria-labelledby="cost-detail-title">
            <div className="operating-card__heading">
              <h2 id="cost-detail-title">비용 상세 입력</h2>
              <label className="excel-import-button">
                <Icon name="upload" size={17} /> Import from Excel
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onAction(`${file.name} 파일을 선택했습니다.`)
                  }}
                />
              </label>
            </div>

            <div className="operating-table-wrap">
              <table>
                <thead><tr><th scope="col">항목</th><th scope="col">유형</th><th scope="col">단가 (KRW)</th><th scope="col">수량/시간</th><th scope="col">총액 (KRW)</th></tr></thead>
                <tbody>
                  {costs.length === 0 ? (
                    <tr><td className="workflow-empty-table" colSpan={5}>등록된 운영비가 없습니다.</td></tr>
                  ) : (
                    costs.map((item) => (
                      <tr key={item.id}>
                        <td><span className="cost-name"><i><Icon name={item.icon} size={22} /></i><span><strong>{item.name}</strong><small>{item.description}</small></span></span></td>
                        <td><span className="cost-type">{item.type}</span></td>
                        <td><input aria-label={`${item.name} 단가`} min="0" type="number" value={item.unitCost} onChange={(event) => updateCost(item.id, 'unitCost', Number(event.target.value))} /></td>
                        <td><input aria-label={`${item.name} 수량 또는 시간`} min="0" type="number" value={item.quantity} onChange={(event) => updateCost(item.id, 'quantity', Number(event.target.value))} /></td>
                        <td><strong>{formatNumber(item.unitCost * item.quantity)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <button className="add-cost-button" type="button" onClick={addCost}><Icon name="add" size={16} /> 항목 추가</button>
              <div className="operating-total"><span>총 운영비 합계</span><strong>{formatNumber(total)}</strong><small>KRW</small></div>
            </div>

          </section>

          <footer className="operating-footer">
            <button className="workflow-back-button" type="button" onClick={() => onNavigate('data-entry-1')}><Icon name="chevron-left" size={16} /> 이전 단계</button>
            <button className="workflow-coral-button" type="button" onClick={() => onNavigate('data-entry-3')}>다음 단계 <Icon name="chevron-right" size={16} /></button>
          </footer>
        </main>
      </div>
    </div>
  )
}
