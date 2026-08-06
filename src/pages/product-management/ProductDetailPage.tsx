import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'
import { ProductCostAnalysis } from '../../components/product-management/ProductCostAnalysis'
import { ProductCostSummary } from '../../components/product-management/ProductCostSummary'
import { useProductCostAnalysis } from '../../components/product-management/useProductCostAnalysis'

type ProductDetailPageProps = {
  product: RecipeProduct
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 4,
})

const numberFormatter = new Intl.NumberFormat('ko-KR')

const percentFormatter = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function ProductDetailPage({ product, onNavigate, onAction }: ProductDetailPageProps) {
  const analysisState = useProductCostAnalysis(product)

  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const totalCost = product.materialCost + product.laborCost + indirectCost

  const sharePercent = (amount: number) => (totalCost > 0 ? (amount / totalCost) * 100 : 0)

  return (
    <div className="dashboard-app product-management-layout">
      <Sidebar activeRoute="product-detail" onNavigate={onNavigate} />

      <main className="product-detail-page">
        <button className="product-create-back" type="button" onClick={() => onNavigate('product-management')}>
          <Icon name="chevron-left" size={16} /> 제품 목록
        </button>

        <header className="product-detail-header">
          <div>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
          </div>
          <div><span>제품 1개 예상 총원가</span><strong>{currencyFormatter.format(totalCost)}</strong></div>
        </header>

        <ProductCostSummary product={product} state={analysisState} onAction={onAction} />

        <div className="product-detail-grid">
          <section className="product-cost-panel" aria-labelledby="material-cost-title">
            <header><div><h2 id="material-cost-title">원재료비 상세</h2><p>레시피 사용량 기준 재료별 비용입니다.</p></div><strong>{currencyFormatter.format(product.materialCost)}</strong></header>
            <div className="material-cost-list material-cost-list--with-price">
              <div className="material-cost-list__head"><span>품명</span><span>수량(kg)</span><span>단가(원)</span><span>금액(원)</span></div>
              {product.ingredients.map((ingredient) => (
                <div key={ingredient.name}>
                  <strong>{ingredient.name}</strong>
                  <span>{ingredient.usage.toLocaleString('ko-KR')} kg</span>
                  <span>{ingredient.unitPrice != null ? numberFormatter.format(ingredient.unitPrice) : '-'}</span>
                  <b>{currencyFormatter.format(ingredient.cost)}</b>
                </div>
              ))}
            </div>
          </section>

          <aside className="product-cost-panel indirect-cost-panel" aria-labelledby="indirect-cost-title">
            <header><div><h2 id="indirect-cost-title">기타비용</h2><p>전체 총원가에서 차지하는 비중입니다.</p></div></header>
            <dl>
              <div>
                <dt>인건비</dt>
                <dd>
                  {currencyFormatter.format(product.laborCost)}
                  <span className="indirect-cost-panel__share">({percentFormatter.format(sharePercent(product.laborCost))}%)</span>
                </dd>
              </div>
              {product.indirectCosts.map((cost) => (
                <div key={cost.name}>
                  <dt>{cost.name}</dt>
                  <dd>
                    {currencyFormatter.format(cost.amount)}
                    <span className="indirect-cost-panel__share">({percentFormatter.format(sharePercent(cost.amount))}%)</span>
                  </dd>
                </div>
              ))}
              <div className="indirect-cost-panel__total">
                <dt>기타비용 합계</dt>
                <dd>
                  {currencyFormatter.format(product.laborCost + indirectCost)}
                  <span className="indirect-cost-panel__share">({percentFormatter.format(sharePercent(product.laborCost + indirectCost))}%)</span>
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <ProductCostAnalysis key={product.id} product={product} state={analysisState} onAction={onAction} />
      </main>
    </div>
  )
}
