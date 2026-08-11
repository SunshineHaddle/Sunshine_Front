import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { OperatingCostForm } from './OperatingCostForm'
import { recordDataEntryCompletion } from '../../utils/dataEntryLog'
import {
  calculateOperatingCosts,
  distributeByProduction,
  getCurrentMonth,
  initialOperatingCosts,
  laborByProduct,
  sumProductFees,
  toWonNumber,
  type CostField,
} from './operatingCostModel'
import {
  PARSED_MATERIALS_STORAGE_KEY,
  PRODUCTION_ENTRY_STORAGE_KEY,
  parseStoredMaterials,
  parseStoredProductionRows,
} from '../raw-material-entry/productionEntryData'

type OperatingCostEntryPageProps = {
  products?: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  hideSidebar?: boolean
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

export function OperatingCostEntryPage({ products = [], onNavigate, onAction, hideSidebar = false }: OperatingCostEntryPageProps) {
  const [storedEntry] = useState(loadStoredOperatingEntry)
  const [month, setMonth] = useState(() => storedEntry?.month ?? getCurrentMonth())
  const [costs, setCosts] = useState(() => ({
    ...initialOperatingCosts,
    ...storedEntry?.costs,
    productFees: storedEntry?.costs?.productFees ?? {},
    customItems: (storedEntry?.costs?.customItems ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      total: item.total ?? '0',
    })),
  }))
  const [productionById] = useState(() => {
    const rows = parseStoredProductionRows(window.localStorage.getItem(PRODUCTION_ENTRY_STORAGE_KEY)) ?? []
    return new Map(rows.map((row) => [row.id, toWonNumber(row.production)]))
  })
  const [productList] = useState(() => {
    const parsed = parseStoredMaterials(window.localStorage.getItem(PARSED_MATERIALS_STORAGE_KEY))
    if (parsed) {
      return parsed.map((p) => ({ id: p.productName, name: p.productName }))
    }
    return products.map((p) => ({ id: p.id, name: p.name }))
  })
  const totals = calculateOperatingCosts(costs)
  const laborShareTotal = sumProductFees(costs.productFees)
  const isLaborShareValid = Math.round(laborShareTotal * 10) / 10 === 100

  const productions = productList.map((product) => ({
    id: product.id,
    production: productionById.get(product.id) ?? 0,
  }))

  const updateCost = (field: CostField, value: string) => {
    setCosts((current) => ({ ...current, [field]: value }))
  }

  const updateProductFee = (productId: string, value: string) => {
    setCosts((current) => ({
      ...current,
      productFees: { ...current.productFees, [productId]: value },
    }))
  }

  const equalizeProductFees = () => {
    if (productList.length === 0) return
    const even = Math.floor((100 / productList.length) * 10) / 10
    const shares: Record<string, string> = {}
    let remaining = 100
    productList.forEach((product, index) => {
      const share = index === productList.length - 1
        ? Math.round(remaining * 10) / 10
        : even
      remaining -= share
      shares[product.id] = String(share)
    })
    setCosts((current) => ({ ...current, productFees: shares }))
  }

  const addCustomItem = () => {
    const id = `custom-${Date.now()}`
    setCosts((current) => ({
      ...current,
      customItems: [...current.customItems, { id, name: '', total: '0' }],
    }))
  }

  const updateCustomItemName = (id: string, name: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.map((item) => (item.id === id ? { ...item, name } : item)),
    }))
  }

  const updateCustomItemTotal = (id: string, value: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.map((item) => (
        item.id === id ? { ...item, total: value } : item
      )),
    }))
  }

  const removeCustomItem = (id: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.filter((item) => item.id !== id),
    }))
  }

  const goToNextStep = () => {
    if (!isLaborShareValid) {
      onAction(`제품별 가공비 비율의 합이 100%가 되어야 합니다. (현재 ${laborShareTotal.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%)`)
      return
    }
    const customItemsWithAllocation = costs.customItems.map((item) => ({
      ...item,
      allocation: distributeByProduction(toWonNumber(item.total), productions),
    }))
    window.localStorage.setItem(
      'cost-analysis-operating-costs',
      JSON.stringify({
        month,
        costs: { ...costs, customItems: customItemsWithAllocation },
        laborByProduct: laborByProduct(costs.laborTotal, costs.productFees),
        totalCost: totals.totalCost,
      }),
    )
    if (hideSidebar) {
      recordDataEntryCompletion('worker1234')
      onAction('데이터 입력을 완료했습니다. 완료 시각이 기록되었습니다.')
      return
    }
    onAction(`${month.replace('-', '년 ')}월 운영비를 저장했습니다.`)
    onNavigate('data-entry-3')
  }

  return (
    <div className="operating-layout">
      {!hideSidebar && <Sidebar activeRoute="data-entry-2" onNavigate={onNavigate} />}

      <main className="operating-page">
        <header className="operating-heading">
          <div>
            <h1>2단계: 현장 운영비</h1>
            <p>제조 공정의 인건비와 운영 항목을 입력하세요.</p>
          </div>
          <label className="operating-month-picker">
            <span className="visually-hidden">비용 기준 월</span>
            <Icon name="calendar" size={17} />
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </header>

        <OperatingCostForm
          products={productList}
          costs={costs}
          productions={productions}
          onCostChange={updateCost}
          onProductFeeChange={updateProductFee}
          onEqualizeProductFees={equalizeProductFees}
          onAddCustomItem={addCustomItem}
          onUpdateCustomItemName={updateCustomItemName}
          onUpdateCustomItemTotal={updateCustomItemTotal}
          onRemoveCustomItem={removeCustomItem}
        />

        <footer className="operating-footer">
          <button className="workflow-back-button" type="button" onClick={() => onNavigate('data-entry-1')}><Icon name="chevron-left" size={16} /> 이전 단계</button>
          {hideSidebar ? (
            <button className="workflow-coral-button" type="button" onClick={goToNextStep} disabled={!isLaborShareValid}>저장 <Icon name="chevron-right" size={16} /></button>
          ) : (
            <button className="workflow-coral-button" type="button" onClick={goToNextStep} disabled={!isLaborShareValid}>다음 단계 <Icon name="chevron-right" size={16} /></button>
          )}
        </footer>
      </main>
    </div>
  )
}
