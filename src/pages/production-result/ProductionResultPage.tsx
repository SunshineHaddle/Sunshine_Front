import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { confirmPeriod, fetchCostSummaries, type CostSummary } from '../../lib/api/results'
import { reopenPeriod } from '../../lib/api/periods'
import { describeDbError } from '../../lib/api/errors'

type ProductionResultPageProps = {
  month: string
  periodId: string | null
  isLocked: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  /** 마감 후 App 이 회차 상태를 다시 읽게 한다 */
  onPeriodChanged?: () => void
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
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    if (!periodId) return
    try {
      // 3단계를 열 때마다 최신 1·2단계 입력으로 다시 계산한다.
      // confirmPeriod 는 마감(status=confirmed)까지 하므로, 아직 작성 중이던
      // 회차는 계산만 반영하고 상태는 작성 중으로 되돌린다.
      if (!isLocked) {
        try {
          await confirmPeriod(periodId)
          await reopenPeriod(periodId)
        } catch (error) {
          onAction(`재계산 실패: ${describeDbError(error)}`)
        }
      }
      setSummaries(await fetchCostSummaries(periodId))
    } catch (error) {
      onAction(`조회 실패: ${describeDbError(error)}`)
    }
  }, [periodId, isLocked, onAction])

  useEffect(() => { void (async () => { await load() })() }, [load])

  // 마감하기: 현재 입력으로 계산하고 그 달을 마감(잠금)한 뒤 대시보드로 간다.
  const closePeriod = async () => {
    if (!periodId) return
    if (!window.confirm(`${month.replace('-', '년 ')}월을 마감할까요?\n마감하면 입력이 잠깁니다. 값을 고치려면 1단계에서 마감을 취소해야 합니다.`)) return
    setClosing(true)
    try {
      await confirmPeriod(periodId)
      onPeriodChanged?.()
      onAction(`${month.replace('-', '년 ')}월을 마감했습니다.`)
      onNavigate('dashboard')
    } catch (error) {
      onAction(`마감 실패: ${describeDbError(error)}`)
    } finally {
      setClosing(false)
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
                        {/* 판매가가 없으면 마진율 0 이 저장된다. '정상 0%' 로 보이면
                            값을 모르는 것과 정상인 것이 구분되지 않는다 */}
                        {s.salePrice > 0 ? (
                          <span className={`result-margin is-${s.status}`}>
                            {s.marginRate.toFixed(1)}% · {STATUS_LABEL[s.status]}
                          </span>
                        ) : (
                          <span className="result-margin is-unknown" title="제품 관리에서 판매가를 입력해주세요">
                            판매가 미입력
                          </span>
                        )}
                      </td>
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
                    <td colSpan={3} />
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
          {isLocked ? (
            <button className="workflow-primary-button" type="button" onClick={() => onNavigate('dashboard')}>
              대시보드로 <Icon name="chevron-right" size={16} />
            </button>
          ) : (
            <button
              className="workflow-primary-button"
              type="button"
              onClick={() => void closePeriod()}
              disabled={closing || !periodId || summaries.length === 0}
            >
              <Icon name="check" size={16} /> 마감하기
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}
