import { Icon } from '../../components/common/Icon'
import {
  formatProductionWon,
  type ProductionCostSummary as CostSummary,
} from './productionResultModel'
import { CostCompositionChart } from './CostCompositionChart'

type ProductionCostSummaryProps = {
  summary: CostSummary
  onEditMaterials: () => void
  onEditOperatingCosts: () => void
}

export function ProductionCostSummary({ summary, onEditMaterials, onEditOperatingCosts }: ProductionCostSummaryProps) {
  return (
    <section className="production-cost-section" aria-labelledby="cost-summary-title">
      <header className="production-section-heading">
        <div>
          <h2 id="cost-summary-title">최종 원가 확인</h2>
          <p>앞 단계에서 입력한 비용을 한 번에 검토하세요.</p>
        </div>
        {summary.month && <span>{summary.month.replace('-', '년 ')}월 기준</span>}
      </header>

      <div className="production-cost-layout">
        <div className="production-cost-details">
          <article className="material-cost-summary">
            <div className="cost-summary-title-row">
              <div><span>원재료비</span><strong>{formatProductionWon(summary.materialCost)}</strong></div>
              <button type="button" onClick={onEditMaterials}>수정</button>
            </div>

            <div className="material-cost-table">
              <table>
                <thead>
                  <tr><th>원재료명</th><th>수량</th><th>단가</th><th>금액</th></tr>
                </thead>
                <tbody>
                  {summary.materials.map((material) => (
                    <tr key={material.id}>
                      <td>{material.name}</td>
                      <td>{material.quantity.toLocaleString('ko-KR')}</td>
                      <td>{formatProductionWon(material.unitCost)}</td>
                      <td>{formatProductionWon(material.amount)}</td>
                    </tr>
                  ))}
                  {!summary.hasMaterialData && (
                    <tr className="material-cost-table__empty"><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="production-operating-summary">
            <div className="cost-summary-title-row">
              <div><span>운영비</span><strong>{formatProductionWon(summary.operatingCost)}</strong></div>
              <button type="button" onClick={onEditOperatingCosts}>수정</button>
            </div>
            <dl>
              <div><dt>인건비</dt><dd>{formatProductionWon(summary.laborCost)}</dd></div>
              <div><dt>공과금</dt><dd>{formatProductionWon(summary.utilityCost)}</dd></div>
              <div><dt>기타 간접비</dt><dd>{formatProductionWon(summary.indirectCost)}</dd></div>
            </dl>
            {!summary.hasOperatingData && (
              <button className="production-empty-state" type="button" onClick={onEditOperatingCosts}>
                <Icon name="add" size={16} /> 2단계에서 운영비를 입력하세요.
              </button>
            )}
          </article>
        </div>

        <CostCompositionChart summary={summary} />
      </div>

      <div className="production-grand-total">
        <span>예상 총원가<small>원재료비 + 인건비 + 공과금 + 기타 간접비</small></span>
        <strong>{formatProductionWon(summary.totalCost)}</strong>
      </div>
    </section>
  )
}
