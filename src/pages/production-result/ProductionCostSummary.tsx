import { Icon } from '../../components/common/Icon'
import {
  formatProductionWon,
  type ProductionCostSummary as CostSummary,
} from './productionResultModel'

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
          <p>앞 단계에서 입력한 수불자료와 운영비를 한 번에 검토하세요.</p>
        </div>
        {summary.month && <span>{summary.month.replace('-', '년 ')}월 기준</span>}
      </header>

      <article className="result-products">
        <div className="cost-summary-title-row">
          <div><span>제품별 원재료비</span><strong>{formatProductionWon(summary.materialCost)}</strong></div>
          <button type="button" onClick={onEditMaterials}>1단계 수정</button>
        </div>

        {summary.products.length === 0 ? (
          <p className="result-products__empty">등록된 제품이 없습니다.</p>
        ) : (
          <div className="result-products__list">
            {summary.products.map((product) => (
              <div className="result-product" key={product.id}>
                <div className="result-product__head">
                  <div className="result-product__title">
                    <strong>{product.name}</strong>
                    <span>생산량 {product.production ? `${Number(product.production).toLocaleString('ko-KR')}kg` : '미입력'}</span>
                  </div>
                  <div className="result-product__figures">
                    <span>가공비 {formatProductionWon(product.processingFee)}</span>
                    <strong>{formatProductionWon(product.materialCost)}</strong>
                  </div>
                </div>
                <table className="result-product__table">
                  <thead>
                    <tr><th>품명</th><th>수량</th><th>단가</th><th>금액</th></tr>
                  </thead>
                  <tbody>
                    {product.materials.map((material) => (
                      <tr key={material.name}>
                        <td>{material.name}</td>
                        <td>{material.usage.toLocaleString('ko-KR')} {material.unit}</td>
                        <td>{material.unitPrice != null ? formatProductionWon(material.unitPrice) : '-'}</td>
                        <td>{formatProductionWon(material.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="production-operating-summary">
        <div className="cost-summary-title-row">
          <div><span>운영비</span><strong>{formatProductionWon(summary.operatingCost)}</strong></div>
          <button type="button" onClick={onEditOperatingCosts}>2단계 수정</button>
        </div>
        <dl>
          <div><dt>총 인건비</dt><dd>{formatProductionWon(summary.laborTotal)}</dd></div>
          {summary.utilityLines.map((line) => (
            <div key={line.label}><dt>{line.label}</dt><dd>{formatProductionWon(line.amount)}</dd></div>
          ))}
        </dl>
        {!summary.hasOperatingData && (
          <button className="production-empty-state" type="button" onClick={onEditOperatingCosts}>
            <Icon name="add" size={16} /> 2단계에서 운영비를 입력하세요.
          </button>
        )}
      </article>

      <div className="production-grand-total">
        <span>예상 총원가<small>제품별 원재료비 + 운영비</small></span>
        <strong>{formatProductionWon(summary.totalCost)}</strong>
      </div>
    </section>
  )
}
