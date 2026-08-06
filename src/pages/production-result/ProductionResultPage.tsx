import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { ProductionCostSummary } from './ProductionCostSummary'
import { loadProductionCostSummary } from './productionResultModel'

type ProductionResultPageProps = {
  products?: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

export function ProductionResultPage({ products = [], onNavigate, onAction }: ProductionResultPageProps) {
  const [costSummary] = useState(() => loadProductionCostSummary(products))

  const finish = () => {
    if (!costSummary.hasMaterialData) {
      onAction('1단계에서 원재료 데이터를 입력해주세요.')
      return
    }
    if (!costSummary.hasOperatingData) {
      onAction('2단계에서 운영비를 입력해주세요.')
      return
    }

    window.localStorage.setItem(
      'cost-analysis-final-result',
      JSON.stringify({
        registeredAt: new Date().toISOString(),
        costs: costSummary,
      }),
    )
    onAction('원가 데이터가 등록되었습니다.')
    onNavigate('dashboard')
  }

  return (
    <div className="production-layout">
      <Sidebar activeRoute="data-entry-3" onNavigate={onNavigate} />

      <main className="production-page">
        <header className="production-heading">
          <div>
            <h1>3단계: 원가 확인</h1>
            <p>원재료비와 운영비를 검토하고 최종 원가를 등록하세요.</p>
          </div>
        </header>

        <ProductionCostSummary
          summary={costSummary}
          onEditMaterials={() => onNavigate('data-entry-1')}
          onEditOperatingCosts={() => onNavigate('data-entry-2')}
        />

        <footer className="production-footer">
          <button className="production-back" type="button" onClick={() => onNavigate('data-entry-2')}><Icon name="chevron-left" size={18} /> 이전 단계</button>
          <button className="production-finish" type="button" onClick={finish}>최종 원가 등록 <Icon name="check" size={18} /></button>
        </footer>
      </main>
    </div>
  )
}
