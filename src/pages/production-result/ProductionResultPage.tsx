import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { ProductionCostSummary } from './ProductionCostSummary'
import {
  calculateYieldRate,
  loadProductionCostSummary,
} from './productionResultModel'

type ProductionResultPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

export function ProductionResultPage({ onNavigate, onAction }: ProductionResultPageProps) {
  const [production, setProduction] = useState('')
  const [waste, setWaste] = useState('')
  const [costSummary] = useState(loadProductionCostSummary)
  const { totalProduction, wasteQuantity, yieldRate, error } = calculateYieldRate(production, waste)

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ['3단계 원가 및 생산 결과'],
      ['기준 월', costSummary.month || '미입력'],
      [],
      ['원재료 내역'],
      ['원재료명', '수량(kg)', '단가(원)', '금액(원)'],
      ...(costSummary.materials.length > 0
        ? costSummary.materials.map((material) => [material.name, material.quantity, material.unitCost, material.amount])
        : [['입력된 원재료 없음']]),
      ['원재료비 합계', '', '', costSummary.materialCost],
      [],
      ['운영비 내역'],
      ['구분', '금액(원)'],
      ['인건비', costSummary.laborCost],
      ['공과금', costSummary.utilityCost],
      ['기타 간접비', costSummary.indirectCost],
      ['운영비 합계', costSummary.operatingCost],
      ['예상 총원가', costSummary.totalCost],
      [],
      ['생산 결과'],
      ['총 생산량(EA)', production ? totalProduction : '미입력'],
      ['불량 수량(EA)', waste ? wasteQuantity : '미입력'],
      ['수율(%)', yieldRate === null ? '미입력' : Number(yieldRate.toFixed(1))],
    ]
    const csv = rows
      .map((row) => row.map((value) => {
        const text = String(value)
        const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
        return `"${safeText.replaceAll('"', '""')}"`
      }).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `원가_생산결과_${costSummary.month || new Date().toISOString().slice(0, 7)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    onAction('원가 및 생산 결과 엑셀 파일을 내보냈습니다.')
  }

  const finish = () => {
    if (!costSummary.hasMaterialData) {
      onAction('1단계에서 원재료 데이터를 입력해주세요.')
      return
    }
    if (!costSummary.hasOperatingData) {
      onAction('2단계에서 운영비를 입력해주세요.')
      return
    }
    if (yieldRate === null) {
      onAction(error || '총 생산량과 불량 수량을 입력해주세요.')
      return
    }

    window.localStorage.setItem(
      'cost-analysis-final-result',
      JSON.stringify({
        registeredAt: new Date().toISOString(),
        costs: costSummary,
        production: totalProduction,
        waste: wasteQuantity,
        yieldRate,
      }),
    )
    onAction(`원가 데이터가 등록되었습니다. 수율 ${yieldRate.toFixed(1)}%`)
    onNavigate('dashboard')
  }

  return (
    <div className="production-layout">
      <Sidebar activeRoute="data-entry-3" onNavigate={onNavigate} />

      <main className="production-page">
        <header className="production-heading">
          <div>
            <h1>3단계: 원가 및 생산 결과 확인</h1>
            <p>원재료비와 운영비를 검토하고 실제 생산 결과를 등록하세요.</p>
          </div>
          <button className="workflow-outline-button production-export" type="button" onClick={exportExcel}>
            <Icon name="excel" size={17} /> 엑셀 내보내기
          </button>
        </header>

        <ProductionCostSummary
          summary={costSummary}
          onEditMaterials={() => onNavigate('data-entry-1')}
          onEditOperatingCosts={() => onNavigate('data-entry-2')}
        />

        <section className="production-result-section" aria-labelledby="production-form-title">
          <header className="production-section-heading">
            <div>
              <h2 id="production-form-title">생산 결과 입력</h2>
              <p>실제 생산량과 불량 수량을 기준으로 수율을 계산합니다.</p>
            </div>
          </header>
          <div className="production-form">
            <div className="production-fields">
              <label>
                <span>총 생산량</span>
                <span className="production-input"><input min="0" type="number" value={production} placeholder="0" onChange={(event) => setProduction(event.target.value)} /><i>EA</i></span>
              </label>
              <label>
                <span>불량 수량</span>
                <span className="production-input"><input min="0" type="number" value={waste} placeholder="0" aria-invalid={Boolean(error)} aria-describedby={error ? 'production-error' : undefined} onChange={(event) => setWaste(event.target.value)} /><i>EA</i></span>
              </label>
            </div>

            <div className="yield-panel">
              <div><strong>예상 수율</strong><b>{yieldRate === null ? '--' : yieldRate.toFixed(1)}%</b></div>
              <code>수식: ((총 생산량 - 불량 수량) / 총 생산량) * 100</code>
              {error && <p id="production-error" role="alert">{error}</p>}
            </div>
          </div>
        </section>

        <footer className="production-footer">
          <button className="production-back" type="button" onClick={() => onNavigate('data-entry-2')}><Icon name="chevron-left" size={18} /> 이전 단계</button>
          <button className="production-finish" type="button" onClick={finish}>최종 원가 등록 <Icon name="check" size={18} /></button>
        </footer>
      </main>
    </div>
  )
}
