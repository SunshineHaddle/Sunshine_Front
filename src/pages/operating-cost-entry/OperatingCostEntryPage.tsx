import { useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { OperatingCostForm } from './OperatingCostForm'
import {
  deleteOperatingCost,
  fetchOperatingCosts,
  saveCustomCost,
  saveLaborCost,
} from '../../lib/api/operating'
import {
  calculateOperatingCosts,
<<<<<<< HEAD
=======
  distributeByProduction,
  getCurrentMonth,
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c
  initialOperatingCosts,
  sumProductFees,
  toWonNumber,
  type CostField,
} from './operatingCostModel'
import {
  PRODUCTION_ENTRY_STORAGE_KEY,
  parseStoredProductionRows,
} from '../raw-material-entry/productionEntryData'

type OperatingCostEntryPageProps = {
  products?: RecipeProduct[]
  month: string
  periodId: string | null
  isLocked: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  hideSidebar?: boolean
}

export function OperatingCostEntryPage({
  products = [],
  month,
  periodId,
  isLocked,
  onNavigate,
  onAction,
  hideSidebar = false,
}: OperatingCostEntryPageProps) {
  const [costs, setCosts] = useState(initialOperatingCosts)
  /** DB 에서 읽은 커스텀 항목의 id. 삭제할 때 필요하다 */
  const [savedIds, setSavedIds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

<<<<<<< HEAD
=======
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
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c
  const totals = calculateOperatingCosts(costs)
  const laborShareTotal = sumProductFees(costs.productFees)
  const isLaborShareValid = Math.round(laborShareTotal * 10) / 10 === 100

<<<<<<< HEAD
  // §7-1 : 해당 월 운영비를 읽어 화면 모델로 바꾼다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!periodId) return
      try {
        const rows = await fetchOperatingCosts(periodId)
        if (cancelled) return

        const labor = rows.find((row) => row.allocation === 'percent')
        const custom = rows.filter((row) => row.allocation === 'amount')

        setCosts({
          laborTotal: labor ? String(labor.totalAmount) : '0',
          productFees: Object.fromEntries(
            (labor?.allocations ?? []).map((a) => [a.productId, String(a.sharePercent ?? 0)]),
          ),
          customItems: custom.map((row) => ({
            id: row.id,
            name: row.name,
            productFees: Object.fromEntries(
              row.allocations.map((a) => [a.productId, String(a.amount)]),
            ),
          })),
        })
        setSavedIds(Object.fromEntries(custom.map((row) => [row.id, row.id])))
      } catch (error) {
        onAction(`조회 실패: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [periodId, onAction])
=======
  const productions = products.map((product) => ({
    id: product.id,
    production: productionById.get(product.id) ?? 0,
  }))
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c

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
    if (products.length === 0) return
    const even = Math.floor((100 / products.length) * 10) / 10
    const shares: Record<string, string> = {}
    let remaining = 100
    products.forEach((product, index) => {
      const share = index === products.length - 1 ? Math.round(remaining * 10) / 10 : even
      remaining -= share
      shares[product.id] = String(share)
    })
    setCosts((current) => ({ ...current, productFees: shares }))
  }

  const addCustomItem = () => {
    setCosts((current) => ({
      ...current,
<<<<<<< HEAD
      customItems: [...current.customItems, { id: `new-${Date.now()}`, name: '', productFees: {} }],
=======
      customItems: [...current.customItems, { id, name: '', total: '0' }],
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c
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
<<<<<<< HEAD
      customItems: current.customItems.map((item) =>
        item.id === id
          ? { ...item, productFees: { ...item.productFees, [productId]: value } }
          : item,
      ),
=======
      customItems: current.customItems.map((item) => (
        item.id === id ? { ...item, total: value } : item
      )),
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c
    }))
  }

  // §7-3 : 이미 저장된 항목이면 DB 에서도 지운다
  const removeCustomItem = (id: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.filter((item) => item.id !== id),
    }))
    if (savedIds[id]) {
      void deleteOperatingCost(id).catch((error: unknown) =>
        onAction(`삭제 실패: ${error instanceof Error ? error.message : String(error)}`),
      )
    }
  }

  /** §7-2 : 인건비(%) + 커스텀 항목(금액)을 저장한다 */
  const persist = async () => {
    if (!periodId) return false
    setBusy(true)
    try {
      await saveLaborCost(periodId, Number(costs.laborTotal) || 0, costs.productFees)
      for (const [index, item] of costs.customItems.entries()) {
        if (!item.name.trim()) continue
        await saveCustomCost(periodId, item.name.trim(), item.productFees, { sortOrder: index + 1 })
      }
      return true
    } catch (error) {
      onAction(`저장 실패: ${error instanceof Error ? error.message : String(error)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const goToNextStep = async () => {
    if (!isLaborShareValid) {
      onAction(
        `제품별 가공비 비율의 합이 100%가 되어야 합니다. (현재 ${laborShareTotal.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%)`,
      )
      return
    }
<<<<<<< HEAD
    if (!(await persist())) return

=======
    const customItemsWithAllocation = costs.customItems.map((item) => ({
      ...item,
      allocation: distributeByProduction(toWonNumber(item.total), productions),
    }))
    window.localStorage.setItem(
      'cost-analysis-operating-costs',
      JSON.stringify({
        month,
        costs: { ...costs, customItems: customItemsWithAllocation },
        totalCost: totals.totalCost,
      }),
    )
>>>>>>> ac4d5a4c5a5d677ec26236e2cd3e780556e1ca4c
    if (hideSidebar) {
      onAction('데이터 입력을 완료했습니다.')
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
          <span className="operating-month-badge">
            <Icon name="calendar" size={16} /> {month.replace('-', '년 ')}월
          </span>
        </header>

        {isLocked && (
          <p className="entry-locked" role="status">
            <Icon name="check" size={14} /> 이 달은 마감되었습니다. 값을 고치려면 마감을 먼저 취소해주세요.
          </p>
        )}

        <OperatingCostForm
          products={products}
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

        <p className="operating-items__total">
          운영비 합계 <strong>{totals.totalCost.toLocaleString('ko-KR')}원</strong>
        </p>

        <footer className="operating-footer">
          <button className="workflow-back-button" type="button" onClick={() => onNavigate('data-entry-1')}>
            <Icon name="chevron-left" size={16} /> 이전 단계
          </button>
          <button
            className="workflow-coral-button"
            type="button"
            onClick={() => void goToNextStep()}
            disabled={!isLaborShareValid || busy || !periodId || isLocked}
          >
            {hideSidebar ? '저장' : '다음 단계'} <Icon name="chevron-right" size={16} />
          </button>
        </footer>
      </main>
    </div>
  )
}
