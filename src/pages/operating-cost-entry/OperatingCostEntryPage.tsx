import { useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { OperatingCostForm } from './OperatingCostForm'
import {
  deleteOperatingCost,
  fetchOperatingCosts,
  saveOperatingCosts,
} from '../../lib/api/operating'
import { fetchProduction } from '../../lib/api/production'
import { markEntrySaved } from '../../utils/entrySaved'
import { describeDbError } from '../../lib/api/errors'
import {
  calculateOperatingCosts,
  distributeByShares,
  equalShares,
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
  /** 이 회차가 마감(잠금)되었는지. 마감되면 저장값을 읽기전용으로 보여준다 */
  isLocked?: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  hideSidebar?: boolean
}

export function OperatingCostEntryPage({
  products = [],
  month,
  periodId,
  freshEntry = false,
  isLocked = false,
  onNavigate,
  onAction,
  hideSidebar = false,
}: OperatingCostEntryPageProps) {
  const [costs, setCosts] = useState(initialOperatingCosts)
  /**
   * 커스텀 항목 배분에 쓰는 제품별 생산량. 예전엔 localStorage 에서 읽었다.
   * 어느 회차 것인지 함께 담는다 — 저장된 운영비를 화면 모델로 바꿀 때 배분 대상
   * 제품이 필요해서(비율이 없는 옛 항목은 균등 분배로 채운다), 이 값으로 순서를 맞춘다.
   */
  const [loadedProductions, setLoadedProductions] =
    useState<{ periodId: string | null; rows: { id: string; production: number }[] } | null>(null)
  const productions = loadedProductions?.rows ?? []
  /** DB 에 이미 있는 항목 id. 삭제 시 필요하다 */
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // 1단계와 같은 규칙 — worker·재접속(freshEntry)은 빈 폼이지만,
  // 마감된 회차는 그와 무관하게 저장된 값을 읽기전용으로 보여준다.
  const loadSaved = !freshEntry || isLocked

  const totals = calculateOperatingCosts(costs)
  const laborShareTotal = sumProductFees(costs.productFees)
  const isLaborShareValid = Math.round(laborShareTotal * 10) / 10 === 100

  const productIds = productions.map((production) => production.id)
  // 이름을 넣은 항목만 저장 대상이라, 비율 검사도 그 항목만 한다
  const invalidCustomItem = productions.length === 0
    ? undefined
    : costs.customItems.find((item) => (
        item.name.trim() !== '' && Math.round(sumProductFees(item.shares) * 10) / 10 !== 100
      ))

  // §5-1 생산량 (배분 기준)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!periodId) {
        setLoadedProductions({ periodId, rows: [] })
        return
      }
      const rows = await fetchProduction(periodId).catch(() => [])
      if (cancelled) return
      // 1단계 엑셀로 생산량이 등록된 제품만 분배 대상 (엑셀에 없는 제품은 제외)
      setLoadedProductions({
        periodId,
        rows: rows.map((row) => ({ id: row.productId, production: row.production })),
      })
    }
    void load()
    return () => { cancelled = true }
  }, [periodId, products])

  // §7-1 해당 월 운영비를 읽어 화면 모델로 바꾼다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // worker 는 재접속마다 빈 폼으로 시작한다 (저장값을 화면에 되불러오지 않음)
      if (!loadSaved) {
        setCosts(initialOperatingCosts)
        setSavedIds(new Set())
        return
      }
      // 이 회차의 생산량을 다 읽은 뒤에 돈다 (배분 대상 제품이 필요하다)
      if (!periodId || loadedProductions?.periodId !== periodId) return
      try {
        const rows = await fetchOperatingCosts(periodId)
        if (cancelled) return

        const labor = rows.find((row) => row.allocation === 'percent')
        const custom = rows.filter((row) => row.allocation === 'amount')
        const targetIds = loadedProductions.rows.map((production) => production.id)

        setCosts({
          laborTotal: labor ? String(labor.totalAmount) : '0',
          productFees: Object.fromEntries(
            (labor?.allocations ?? []).map((a) => [a.productId, String(a.sharePercent ?? 0)]),
          ),
          customItems: custom.map((row) => ({
            id: row.id,
            name: row.name,
            total: String(row.totalAmount),
            // 추가 항목은 금액으로 저장된다. 화면은 비율로 다루므로 되돌려 계산한다.
            // 비율을 쓰기 전에 저장된 항목은 배분 행이 없을 수 있어 균등 분배로 채운다.
            shares: row.totalAmount > 0 && row.allocations.length > 0
              ? Object.fromEntries(row.allocations.map((a) => [
                  a.productId,
                  String(Math.round((a.amount / row.totalAmount) * 1000) / 10),
                ]))
              : equalShares(targetIds),
          })),
        })
        setSavedIds(new Set(custom.map((row) => row.id)))
      } catch (error) {
        onAction(`조회 실패: ${describeDbError(error)}`)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [periodId, onAction, loadSaved, loadedProductions])

  const updateCost = (field: CostField, value: string) => {
    setCosts((current) => ({ ...current, [field]: value }))
  }

  const updateProductFee = (productId: string, value: string) => {
    setCosts((current) => ({
      ...current,
      productFees: { ...current.productFees, [productId]: value },
    }))
  }

  /** 1단계 엑셀에 넣은 제품만 배분 대상 (인건비·추가 항목 공통) */
  const targetProductIds = () =>
    products.filter((p) => productions.some((pr) => pr.id === p.id)).map((p) => p.id)

  const equalizeProductFees = () => {
    const targets = targetProductIds()
    if (targets.length === 0) return
    setCosts((current) => ({ ...current, productFees: equalShares(targets) }))
  }

  const updateCustomItemShare = (id: string, productId: string, value: string) => {
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.map((item) => (
        item.id === id ? { ...item, shares: { ...item.shares, [productId]: value } } : item
      )),
    }))
  }

  const equalizeCustomItemShares = (id: string) => {
    const targets = targetProductIds()
    if (targets.length === 0) return
    setCosts((current) => ({
      ...current,
      customItems: current.customItems.map((item) => (
        item.id === id ? { ...item, shares: equalShares(targets) } : item
      )),
    }))
  }

  const addCustomItem = () => {
    const id = `custom-${Date.now()}`
    setCosts((current) => ({
      ...current,
      // 새 항목은 균등 분배로 시작한다 — 예전 동작(무조건 균등)과 같은 출발점
      customItems: [...current.customItems, { id, name: '', total: '0', shares: equalShares(targetProductIds()) }],
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

  const resetEntry = () => {
    if (isLocked) return
    if (!window.confirm('입력한 인건비와 비율, 운영 항목을 화면에서 지울까요?\n이미 저장된 데이터는 그대로 남습니다.')) return
    setCosts(initialOperatingCosts)
    onAction('입력 내용을 초기화했습니다.')
  }

  // §7-3 이미 저장된 항목이면 DB 에서도 지운다
  const removeCustomItem = (id: string) => {
    if (isLocked) return
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
   * 커스텀 항목은 화면에서 총액과 제품별 비율(%)을 받고, DB 에는 금액으로 환산해 넣는다.
   */
  const persist = async () => {
    if (!periodId) return false
    setBusy(true)
    try {
      // 한 번에 맞춘다. 항목별로 저장하면 화면에서 지운 항목이 DB 에 남아
      // 마감 때 원가에 계속 섞인다 (saveOperatingCosts 주석 참고)
      await saveOperatingCosts({
        periodId,
        laborTotal: toWonNumber(costs.laborTotal),
        laborShares: costs.productFees,
        customItems: costs.customItems
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            amountsByProduct: distributeByShares(toWonNumber(item.total), item.shares, productIds),
          })),
      })
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
    // 마감된 회차는 RLS 가 쓰기를 막는다. 저장 시도 자체를 하지 않는다.
    if (isLocked) {
      onAction('마감된 회차입니다. 값을 고치려면 1단계에서 마감을 취소하세요.')
      return
    }
    if (!isLaborShareValid) {
      onAction(`제품별 가공비 비율의 합이 100%가 되어야 합니다. (현재 ${laborShareTotal.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%)`)
      return
    }
    if (invalidCustomItem) {
      const share = sumProductFees(invalidCustomItem.shares)
      onAction(
        `${invalidCustomItem.name.trim()} 항목의 제품별 비율 합이 100%가 되어야 합니다. `
        + `(현재 ${share.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%)`,
      )
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
          <button className="workflow-outline-button" type="button" onClick={resetEntry} disabled={isLocked}>
            <Icon name="trash" size={16} /> 초기화
          </button>
        </header>

        {isLocked && (
          <p className="entry-locked" role="status">
            <Icon name="info" size={15} />
            <span>
              {month.replace('-', '년 ')}월은 마감되어 있습니다. 저장된 인건비와 운영 항목을 읽기전용으로 보여줍니다.
              값을 고치려면 1단계에서 <strong>마감 풀고 수정</strong> 을 누르세요.
            </span>
          </p>
        )}

        <OperatingCostForm
          products={products}
          costs={costs}
          productions={productions}
          readOnly={isLocked}
          onCostChange={updateCost}
          onProductFeeChange={updateProductFee}
          onEqualizeProductFees={equalizeProductFees}
          onAddCustomItem={addCustomItem}
          onUpdateCustomItemName={updateCustomItemName}
          onUpdateCustomItemTotal={updateCustomItemTotal}
          onUpdateCustomItemShare={updateCustomItemShare}
          onEqualizeCustomItemShares={equalizeCustomItemShares}
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
            disabled={isLocked || !isLaborShareValid || Boolean(invalidCustomItem) || busy || !periodId}
            title={isLocked ? '마감된 회차입니다. 수정하려면 1단계에서 마감을 취소하세요.' : undefined}
          >
            {hideSidebar ? '저장' : '다음 단계'} <Icon name="chevron-right" size={16} />
          </button>
        </footer>
      </main>
    </div>
  )
}
