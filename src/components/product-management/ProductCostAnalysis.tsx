import { useState } from 'react'
import { Icon } from '../common/Icon'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import type { ProductCostAnalysisState } from './useProductCostAnalysis'

type ProductCostAnalysisProps = {
  product: RecipeProduct
  state: ProductCostAnalysisState
  onAction: (message: string) => void
}

const laborTrend = [72, 66, 61, 54, 49, 42]
const numberFormatter = new Intl.NumberFormat('ko-KR')

export function ProductCostAnalysis({ product, state, onAction }: ProductCostAnalysisProps) {
  const { costRate, costComposition } = state

  const [showDetails, setShowDetails] = useState(false)
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [includeTrend, setIncludeTrend] = useState(true)
  const [includeDetails, setIncludeDetails] = useState(true)
  const [includeCompetitors, setIncludeCompetitors] = useState(false)

  const printReport = () => {
    onAction('인쇄 창에서 PDF로 저장할 수 있습니다.')
    window.print()
  }

  return (
    <section
      className="product-cost-analysis"
      id="product-cost-analysis"
      aria-labelledby="product-cost-analysis-title"
    >
      <header className="product-cost-analysis__header">
        <div>
          <p className="product-cost-analysis__eyebrow">COST ANALYSIS</p>
          <h2 id="product-cost-analysis-title">제품별 월간 원가 분석</h2>
          <span>선택한 제품의 상세 원가 지표와 변동 추이를 분석합니다.</span>
        </div>
        <dl className="product-cost-analysis__owner">
          <div>
            <dt>관리자 성함</dt>
            <dd>Cost Strategy Team</dd>
          </div>
          <div>
            <dt>대상 제품</dt>
            <dd>{product.name}</dd>
          </div>
        </dl>
      </header>

      <div className="cost-analysis-detail-grid">
        <article className="cost-analysis-panel cost-composition">
          <div className="cost-analysis-panel__heading">
            <div>
              <h3>원가 구성 상세</h3>
              <p>총원가에서 각 항목이 차지하는 비중입니다.</p>
            </div>
            <strong>전월 대비 5.0% 상승</strong>
          </div>

          <div className="cost-composition__bar" aria-label="원가 구성 비중">
            {costComposition.map((item) => (
              <span
                className={`cost-composition__segment cost-composition__segment--${item.id}`}
                key={item.id}
                style={{ width: `${item.value}%` }}
                title={`${item.label} ${item.value.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="cost-composition__legend">
            {costComposition.map((item) => (
              <div key={item.id}>
                <span className={`cost-composition__dot cost-composition__dot--${item.id}`} />
                <p>{item.label}<strong>{item.value.toFixed(1)}%</strong></p>
              </div>
            ))}
          </div>
        </article>

        <article className="cost-analysis-panel labor-trend">
          <div className="cost-analysis-panel__heading">
            <div>
              <h3>인건비 월별 변화</h3>
              <p>생산량 대비 인건비 비중이 증가하고 있습니다.</p>
            </div>
            <span className="labor-trend__change">+3.2%</span>
          </div>
          <svg viewBox="0 0 360 96" role="img" aria-label="2026년 1월부터 6월까지 인건비 변화">
            {[20, 48, 76].map((y) => <line key={y} x1="4" x2="356" y1={y} y2={y} />)}
            <polyline points={laborTrend.map((y, index) => `${8 + index * 68},${y}`).join(' ')} />
            {laborTrend.map((y, index) => (
              <circle key={y} cx={8 + index * 68} cy={y} r="3">
                <title>{`${index + 1}월 인건비 지수`}</title>
              </circle>
            ))}
          </svg>
          <div className="labor-trend__months">
            {['1월', '2월', '3월', '4월', '5월', '6월'].map((month) => <span key={month}>{month}</span>)}
          </div>
        </article>

        <article className="cost-analysis-panel cost-rate-status">
          <div className="cost-analysis-panel__heading">
            <div>
              <h3>판매가 대비 원가율</h3>
              <p>목표 원가율과 현재 수준을 비교합니다.</p>
            </div>
            <span className="cost-rate-status__badge">주의 단계</span>
          </div>
          <div className="cost-rate-status__number">
            <strong>{costRate.toFixed(1)}%</strong>
            <span>목표 70.0%</span>
          </div>
          <div className="cost-rate-status__track">
            <span style={{ width: `${Math.min(costRate, 100)}%` }} />
            <i style={{ left: '70%' }} />
          </div>
          <p>목표 원가율(70%) 대비 {(costRate - 70).toFixed(1)}%p 초과되었습니다.</p>
        </article>
      </div>

      <div className="cost-analysis-actions">
        <button
          className="cost-analysis-actions__text"
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((current) => !current)}
        >
          상세 원가 데이터 보기
          <Icon
            className={showDetails ? 'is-open' : ''}
            name="chevron-right"
            size={16}
          />
        </button>
        <button
          className="button button--secondary"
          type="button"
          aria-expanded={showReportOptions}
          onClick={() => setShowReportOptions((current) => !current)}
        >
          <Icon name="report" size={16} />
          보고서 추출
        </button>
      </div>

      {showDetails && (
        <div className="cost-analysis-data">
          <table>
            <thead>
              <tr><th>원가 항목</th><th>구성비</th><th>금액</th><th>전월 대비</th></tr>
            </thead>
            <tbody>
              {costComposition.map((item, index) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{item.value.toFixed(1)}%</td>
                  <td>{numberFormatter.format(item.amount)}원</td>
                  <td>{index < 2 ? '상승' : '유지'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showReportOptions && (
        <div className="cost-report-options">
          <div className="cost-report-options__period">
            <span>기간 선택</span>
            <label>시작 월<input type="month" defaultValue="2026-01" /></label>
            <span aria-hidden="true">—</span>
            <label>종료 월<input type="month" defaultValue="2026-06" /></label>
          </div>
          <fieldset>
            <legend>추가 포함 항목</legend>
            <label><input type="checkbox" checked={includeTrend} onChange={(event) => setIncludeTrend(event.target.checked)} />월별 추이 그래프</label>
            <label><input type="checkbox" checked={includeDetails} onChange={(event) => setIncludeDetails(event.target.checked)} />세부 항목 명세</label>
            <label><input type="checkbox" checked={includeCompetitors} onChange={(event) => setIncludeCompetitors(event.target.checked)} />경쟁사 비교 데이터</label>
          </fieldset>
          <div className="cost-report-options__buttons">
            <button className="button button--secondary" type="button" onClick={() => onAction('보고서 미리보기를 준비했습니다.')}>미리보기</button>
            <button className="button button--primary" type="button" onClick={printReport}><Icon name="download" size={16} />PDF 다운로드</button>
          </div>
        </div>
      )}
    </section>
  )
}
