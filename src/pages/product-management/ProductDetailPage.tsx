import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'

type ProductDetailPageProps = {
  product: RecipeProduct
  onNavigate: (route: AppRoute) => void
}

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

export function ProductDetailPage({ product, onNavigate }: ProductDetailPageProps) {
  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const totalCost = product.materialCost + product.laborCost + indirectCost

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

        <div className="product-cost-overview">
          <section><span>원재료비</span><strong>{currencyFormatter.format(product.materialCost)}</strong><small>{product.ingredients.length}개 재료</small></section>
          <section><span>인건비</span><strong>{currencyFormatter.format(product.laborCost)}</strong><small>직접 작업 인건비</small></section>
          <section><span>기타 간접비</span><strong>{currencyFormatter.format(indirectCost)}</strong><small>전기세·식대·이자 비용</small></section>
        </div>

        <div className="product-detail-grid">
          <section className="product-cost-panel" aria-labelledby="material-cost-title">
            <header><div><h2 id="material-cost-title">원재료비 상세</h2><p>레시피 사용량 기준 재료별 비용입니다.</p></div><strong>{currencyFormatter.format(product.materialCost)}</strong></header>
            <div className="material-cost-list">
              <div className="material-cost-list__head"><span>재료</span><span>사용량</span><span>금액</span></div>
              {product.ingredients.map((ingredient) => (
                <div key={ingredient.name}><strong>{ingredient.name}</strong><span>{ingredient.usage} {ingredient.unit}</span><b>{currencyFormatter.format(ingredient.cost)}</b></div>
              ))}
            </div>
          </section>

          <aside className="product-cost-panel indirect-cost-panel" aria-labelledby="indirect-cost-title">
            <header><div><h2 id="indirect-cost-title">기타 비용</h2><p>생산 단위에 배분된 비용입니다.</p></div></header>
            <dl>
              <div><dt>인건비</dt><dd>{currencyFormatter.format(product.laborCost)}</dd></div>
              {product.indirectCosts.map((cost) => <div key={cost.name}><dt>{cost.name}</dt><dd>{currencyFormatter.format(cost.amount)}</dd></div>)}
              <div className="indirect-cost-panel__total"><dt>기타 비용 합계</dt><dd>{currencyFormatter.format(product.laborCost + indirectCost)}</dd></div>
            </dl>
          </aside>
        </div>
      </main>
    </div>
  )
}
