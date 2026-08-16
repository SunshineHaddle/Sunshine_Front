import { useMemo, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'
import { thumbnailUrl } from '../../utils/thumbnail'

type ProductManagementPageProps = {
  products: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  onSelectProduct: (productId: string) => void
}

export function ProductManagementPage({
  products = [],
  onNavigate,
  onSelectProduct,
}: ProductManagementPageProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  const filteredProducts = useMemo(
    () => products.filter((product) =>
      !normalizedQuery || [product.id, product.name, ...product.ingredients.map((ingredient) => ingredient.name)].some((value) =>
        value.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
      ),
    ),
    [normalizedQuery, products],
  )

  return (
    <div className="dashboard-app product-management-layout">
      <Sidebar activeRoute="product-management" onNavigate={onNavigate} />

      <main className="recipe-library-page">
        <header className="recipe-library-header">
          <div>
            <h1>제품 관리</h1>
            <p>재료 비용, 수율 목표 및 제조 사양을 관리합니다.</p>
          </div>
          <label className="recipe-search">
            <Icon name="search" size={16} />
            <span className="visually-hidden">레시피 검색</span>
            <input
              type="search"
              value={query}
              placeholder="레시피 검색..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        <section className="recipe-library" aria-labelledby="recipe-library-title">
          <div className="recipe-library__label">
            <h2 id="recipe-library-title">활성 제품군</h2>
            <span>총 {filteredProducts.length}개 제품</span>
          </div>

          <div className="recipe-card-grid">
            {filteredProducts.map((product) => (
              <article className="recipe-card" key={product.id}>
                <div className="recipe-card__body">
                  <div className="recipe-card__info">
                    <h3>{product.name}</h3>
                    <p>({product.ingredients.map((ingredient) => ingredient.name).join(', ')})</p>
                  </div>
                  <span className="recipe-card__thumb" aria-hidden="true">
                    {product.imageUrl
                      ? (
                        <img
                          src={thumbnailUrl(product.imageUrl, 320)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={108}
                          height={108}
                          onError={(event) => {
                            const img = event.currentTarget
                            img.style.display = 'none'
                            const fallback = img.nextElementSibling as HTMLElement | null
                            if (fallback) fallback.style.display = ''
                          }}
                        />
                      )
                      : null}
                    <span
                      className="recipe-card__thumb-fallback"
                      style={product.imageUrl ? { display: 'none' } : undefined}
                    >
                      {product.name.slice(0, 1)}
                    </span>
                  </span>
                </div>
                <footer>
                  <button type="button" aria-label={`${product.name} 원가 상세 보기`} onClick={() => onSelectProduct(product.id)}>
                    <Icon name="chevron-right" size={18} />
                  </button>
                </footer>
              </article>
            ))}
            {!normalizedQuery && (
              <button
                className="recipe-card recipe-card--create"
                type="button"
                onClick={() => onNavigate('product-create')}
              >
                <span className="recipe-card--create__label">
                  <span className="recipe-card--create__icon">
                    <Icon name="add" size={20} />
                  </span>
                  <span>
                    <strong>제품 추가</strong>
                    <small>새 제품과 레시피 등록</small>
                  </span>
                </span>
              </button>
            )}
          </div>

          {filteredProducts.length === 0 && (
            <p className="recipe-library__empty">검색 조건에 맞는 레시피가 없습니다.</p>
          )}
        </section>

      </main>
    </div>
  )
}
