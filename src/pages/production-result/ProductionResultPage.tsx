import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { confirmPeriod, fetchCostSummaries, type CostSummary } from '../../lib/api/results'
import { reopenPeriod } from '../../lib/api/periods'

type ProductionResultPageProps = {
  month: string
  periodId: string | null
  isLocked: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  onPeriodChanged: () => void
}

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

const STATUS_LABEL = { normal: '정상', watch: '주의', risk: '위험' } as const

export function ProductionResultPage({
  month,
  periodId,
  isLocked,
  onNavigate,
  onAction,
  onPeriodChanged,
}: ProductionResultPageProps) {
  const [summaries, setSummaries] = useState<CostSummary[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!periodId) return
    try {
      setSummaries(await fetchCostSummaries(periodId))
    } catch (error) {
      onAction(`조회 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [periodId, onAction])

  useEffect(() => { void load() }, [load])

  const runConfirm = async () => {
    if (!periodId) return
    setBusy(true)
    try {
      const count = await confirmPeriod(periodId)
      await load()
      onPeriodChanged()
      onAction(
        count > 0
          ? `${count}개 제품의 원가를 계산했습니다.`
          : '계산할 데이터가 없습니다. 1단계에서 생산량을 먼저 입력해주세요.',
      )
    } catch (error) {
      onAction(`계산 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const runReopen = async () => {
    if (!periodId) return
    setBusy(true)
    try {
      await reopenPeriod(periodId)
      onPeriodChanged()
      onAction('마감을 취소했습니다. 1·2단계에서 값을 고친 뒤 다시 계산하세요.')
    } catch (error) {
      onAction(`마감 취소 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const grand = summaries.reduce(
    (acc, s) => ({
      material: acc.material + s.materialCost,
      labor: acc.labor + s.laborCost,
      utility: acc.utility + s.utilityCost,
      total: acc.total + s.totalCost,
    }),
    { material: 0, labor: 0, utility: 0, total: 0 },
  )

  return (
    <div className="production-layout">
      <Sidebar activeRoute="data-entry-3" onNavigate={onNavigate} />

      <main className="production-page">
        <header className="production-heading">
          <div>
            <h1>데이터 입력 3단계: 원가 확인</h1>
            <p>1·2단계 입력으로 제품별 원가를 계산합니다. 값을 고치면 다시 계산할 수 있습니다.</p>
          </div>
          <span className="operating-month-badge">
            <Icon name="calendar" size={16} /> {month.replace('-', '년 ')}월
          </span>
        </header>

        <section className="result-actions">
          <div className="result-actions__state">
            상태{' '}
            <strong className={isLocked ? 'is-confirmed' : 'is-draft'}>
              {isLocked ? '마감됨' : '작성 중'}
            </strong>
          </div>
          <div className="result-actions__buttons">
            {isLocked && (
              <button className="workflow-outline-button" type="button" disabled={busy} onClick={runReopen}>
                마감 취소
              </button>
            )}
            <button className="production-finish" type="button" disabled={busy || !periodId} onClick={runConfirm}>
              {summaries.length > 0 ? '다시 계산' : '원가 계산'} <Icon name="check" size={18} />
            </button>
          </div>
        </section>

        {summaries.length === 0 ? (
          <section className="production-empty">
            <span className="production-empty__icon"><Icon name="factory" size={30} /></span>
            <p>아직 계산된 원가가 없습니다</p>
            <span>1·2단계를 입력한 뒤 <strong>원가 계산</strong>을 눌러주세요.</span>
          </section>
        ) : (
          <section className="result-table-card" aria-labelledby="result-table-title">
            <h2 id="result-table-title">제품별 원가</h2>
            <div className="result-table-scroll">
              <table className="result-table">
                <thead>
                  <tr>
                    <th scope="col">제품</th>
                    <th scope="col">생산량</th>
                    <th scope="col">재료비</th>
                    <th scope="col">노무비</th>
                    <th scope="col">경비</th>
                    <th scope="col">경영 총원가</th>
                    <th scope="col">단위원가</th>
                    <th scope="col">판매가</th>
                    <th scope="col">마진율</th>
                    <th scope="col">수율</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.productId}>
                      <td data-label="제품">
                        <strong>{s.name}</strong>
                        <small className={`result-source result-source--${s.costSource}`}>
                          {s.costSource === 'actual' ? '실측' : '표준'}
                        </small>
                      </td>
                      <td data-label="생산량">{won(s.productionQty)} kg</td>
                      <td data-label="재료비">{won(s.materialCost)}</td>
                      <td data-label="노무비">{won(s.laborCost)}</td>
                      <td data-label="경비">{won(s.utilityCost)}</td>
                      <td data-label="경영 총원가"><strong>{won(s.totalCost)}</strong></td>
                      <td data-label="단위원가">{won(s.unitCost)}</td>
                      <td data-label="판매가">{won(s.salePrice)}</td>
                      <td data-label="마진율">
                        <span className={`result-margin is-${s.status}`}>
                          {s.marginRate.toFixed(1)}% · {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td data-label="수율">{s.yieldRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">합계</th>
                    <td />
                    <td>{won(grand.material)}</td>
                    <td>{won(grand.labor)}</td>
                    <td>{won(grand.utility)}</td>
                    <td><strong>{won(grand.total)}</strong></td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="result-table-note">
              <strong>실측</strong>은 수불자료로 입력된 실제 투입량, <strong>표준</strong>은 레시피 × 생산량으로 계산한 값입니다.
            </p>
          </section>
        )}

        <footer className="production-footer">
          <button className="production-back" type="button" onClick={() => onNavigate('data-entry-2')}>
            <Icon name="chevron-left" size={18} /> 이전 단계
          </button>
          <button className="workflow-primary-button" type="button" onClick={() => onNavigate('dashboard')}>
            대시보드로 <Icon name="chevron-right" size={16} />
          </button>
        </footer>
      </main>
    </div>
  )
}
