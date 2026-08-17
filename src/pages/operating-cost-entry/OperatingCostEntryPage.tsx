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
import { fetchProduction } from '../../lib/api/production'
import { markEntrySaved } from '../../utils/entrySaved'
import { describeDbError } from '../../lib/api/errors'
import {
  calculateOperatingCosts,
  distributeByProduction,
  initialOperatingCosts,
  sumProductFees,
  toWonNumber,
  type CostField,
} from './operatingCostModel'

type OperatingCostEntryPageProps = {
  products?: RecipeProduct[]
  month: string
  periodId: string | null
  /** worker 처럼 재접속 시 저장값을 화면에 불러오지 않고 빈 폼으로 시작 */
  freshEntry?: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  hideSidebar?: boolean
}

export function OperatingCostEntryPage({
  products = [],
  month,
  periodId,
  freshEntry = false,
  onNavigate,
  onAction,
  hideSidebar = false,
}: OperatingCostEntryPageProps) {
  const [costs, setCosts] = useState(initialOperatingCosts)
  /** 커스텀 항목 배분에 쓰는 제품별 생산량. 예전엔 localStorage 에서 읽었다 */
  const [productions, setProductions] = useState<{ id: string; production: number }[]>([])
  /** DB 에 이미 있는 항목 id. 삭제 시 필요하다 */
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const totals = calculateOperatingCosts(costs)
  const laborShareTotal = sumProductFees(costs.productFees)
  const isLaborShareValid = Math.round(laborShareTotal * 10) / 10 === 100

  // §5-1 생산량 (배분 기준)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!periodId) { setProductions([]); return }
      const rows = await fetchProduction(periodId).catch(() => [])
      if (cancelled) return
      const byId = new Map(rows.map((row) => [row.productId, row.production]))
      setProductions(products.map((p) => ({ id: p.id, production: byId.get(p.id) ?? 0 })))
    }
    void load()
    return () => { cancelled = true }
  }, [periodId, products])

  // §7-1 해당 월 운영비를 읽어 화면 모델로 바꾼다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // worker 는 재접속마다 빈 폼으로 시작한다 (저장값을 화면에 되불러오지 않음)
      if (freshEntry) {
        setCosts(initialOperatingCosts)
        setSavedIds(new Set())
        return
      }
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
            total: String(row.totalAmount),
          })),
        })
        setSavedIds(new Set(custom.map((row) => row.id)))
      } catch (error) {
        onAction(`조회 실패: ${describeDbError(error)}`)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [periodId, onAction, freshEntry])

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

  // §7-3 이미 저장된 항목이면 DB 에서도 지운다
  const removeCustomItem = (id: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.filter((item) => item.id !== id),
    }))
    if (savedIds.has(id)) {
      void deleteOperatingCost(id).catch((error: unknown) =>
        onAction(`삭제 실패: ${describeDbError(error)}`),
      )
    }
  }

  /**
   * §7-2 인건비(%) + 커스텀 항목(총액)을 저장한다.
   * 커스텀 항목은 화면에서 총액만 받고, 제품별 금액은 생산량 비례로 배분해 넣는다.
   */
  const persist = async () => {
    if (!periodId) return false
    setBusy(true)
    try {
      await saveLaborCost(periodId, toWonNumber(costs.laborTotal), costs.productFees)

      for (const [index, item] of costs.customItems.entries()) {
        if (!item.name.trim()) continue
        const allocation = distributeByProduction(toWonNumber(item.total), productions)
        await saveCustomCost(periodId, item.name.trim(), allocation, { sortOrder: index + 1 })
      }
      markEntrySaved(periodId) // 저장 완료 → 재접속 시 빈 폼
      return true
    } catch (error) {
      onAction(`저장 실패: ${describeDbError(error)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const goToNextStep = async () => {
    if (!isLaborShareValid) {
      onAction(`제품별 가공비 비율의 합이 100%가 되어야 합니다. (현재 ${laborShareTotal.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%)`)
      return
    }
    if (!(await persist())) return

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
        </header>

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
            disabled={!isLaborShareValid || busy || !periodId}
          >
            {hideSidebar ? '저장' : '다음 단계'} <Icon name="chevron-right" size={16} />
          </button>
        </footer>
      </main>
    </div>
  )
}
