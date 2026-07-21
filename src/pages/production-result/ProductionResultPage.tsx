import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import { WorkflowStepper } from '../../components/workflow/WorkflowStepper'
import type { AppRoute } from '../../data/navigation'

type ProductionResultPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

export function ProductionResultPage({ onNavigate, onAction }: ProductionResultPageProps) {
  const [production, setProduction] = useState('')
  const [waste, setWaste] = useState('')

  const totalProduction = Number(production)
  const wasteQuantity = Number(waste)
  let yieldRate: number | null = null
  let error = ''

  if (production && waste && totalProduction > 0) {
    if (wasteQuantity < 0 || wasteQuantity > totalProduction) {
      error = '불량 수량은 총 생산량보다 클 수 없습니다.'
    } else {
      yieldRate = ((totalProduction - wasteQuantity) / totalProduction) * 100
    }
  }

  const finish = () => {
    if (yieldRate === null) {
      onAction(error || '총 생산량과 불량 수량을 입력해주세요.')
      return
    }

    window.localStorage.setItem(
      'cost-analysis-production-result',
      JSON.stringify({ production: totalProduction, waste: wasteQuantity, yieldRate }),
    )
    onAction(`월말 마감이 완료되었습니다. 수율 ${yieldRate.toFixed(1)}%`)
    onNavigate('dashboard')
  }

  return (
    <div className="production-layout">
      <Sidebar activeRoute="data-entry-3" onNavigate={onNavigate} />

      <main className="production-page">
        <header className="production-heading">
          <h1>데이터 입력 3단계: 생산 결과</h1>
          <p>최종 생산 수량과 불량 수량을 입력하여 수율을 확인하세요.</p>
        </header>

        <WorkflowStepper activeStep={3} labels={['기초 정보', '비용 입력', '생산 결과']} />

        <section className="production-card" aria-labelledby="production-form-title">
          <div className="production-form">
            <h2 className="visually-hidden" id="production-form-title">생산 결과 입력</h2>
            <label>
              <span>총 생산량 (Total Production)</span>
              <span className="production-input"><input min="0" type="number" value={production} placeholder="0" onChange={(event) => setProduction(event.target.value)} /><i>EA</i></span>
            </label>
            <label>
              <span>불량 수량 (Waste Quantity)</span>
              <span className="production-input"><input min="0" type="number" value={waste} placeholder="0" aria-invalid={Boolean(error)} aria-describedby={error ? 'production-error' : undefined} onChange={(event) => setWaste(event.target.value)} /><i>EA</i></span>
            </label>

            <div className="yield-panel">
              <div><strong>수율 (Yield Rate)</strong><b>{yieldRate === null ? '--' : yieldRate.toFixed(1)} %</b></div>
              <code>수식: ((총 생산량 - 불량 수량) / 총 생산량) * 100</code>
              {error && <p id="production-error" role="alert">{error}</p>}
            </div>
          </div>
        </section>

        <footer className="production-footer">
          <button className="production-back" type="button" onClick={() => onNavigate('data-entry-2')}><Icon name="chevron-left" size={18} /> 이전 단계</button>
          <button className="production-finish" type="button" onClick={finish}>월말 마감 (Finish Month-end) <Icon name="check" size={18} /></button>
        </footer>
      </main>
    </div>
  )
}
