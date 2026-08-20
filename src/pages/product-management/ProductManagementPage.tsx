import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'
import { thumbnailUrl } from '../../utils/thumbnail'
import { fetchLatestUsageMaterials, type ProductMaterialNames } from '../../lib/api/production'

type ProductManagementPageProps = {
  products: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  onSelectProduct: (productId: string) => void
  /** 숨긴 제품(is_active = false). 되돌리기 목록에 쓴다 */
  hiddenProducts?: { id: string; sku: string; name: string }[]
  onRestoreProduct?: (productId: string) => Promise<void>
  /** 숨긴 제품을 DB 에서 완전히 지운다 */
  onDeleteProduct?: (productId: string) => Promise<void>
}

export function ProductManagementPage({
  products = [],
  onNavigate,
  onSelectProduct,
  hiddenProducts = [],
  onRestoreProduct,
  onDeleteProduct,
}: ProductManagementPageProps) {
  /** 처리 중인 제품 id. 되돌리기·삭제 버튼을 함께 잠근다 */
  const [busyId, setBusyId] = useState('')

  /**
   * 카드에 띄울 투입 재료. 수불자료 실적이 있으면 그쪽을 먼저 쓴다.
   * 표준 배합(recipe_items)만 보면 엑셀로 등록된 제품이 텅 비어 보인다.
   */
  const [usageMaterials, setUsageMaterials] = useState<ProductMaterialNames>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchLatestUsageMaterials().catch((error: unknown) => {
        console.error('[투입 재료] 조회 실패', error)
        return {} as ProductMaterialNames
      })
      if (!cancelled) setUsageMaterials(rows)
    })()
    return () => { cancelled = true }
  }, [])

  /** 실적 우선, 없으면 표준 배합. confirm_period() 의 재료비 계산 순서와 같다 */
  const materialsOf = useCallback((product: RecipeProduct) => {
    const actual = usageMaterials[product.id]
    if (actual) return { names: actual.names, source: `${actual.month} 수불자료` }
    const recipe = product.ingredients.map((ingredient) => ingredient.name)
    return { names: recipe, source: recipe.length > 0 ? '표준 배합' : '' }
  }, [usageMaterials])

  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  // 검색도 카드에 보이는 재료를 따라간다. 화면에 뜬 이름으로 찾을 수 있어야 한다
  const filteredProducts = useMemo(
    () => products.filter((product) =>
      !normalizedQuery || [product.id, product.name, ...materialsOf(product).names].some((value) =>
        value.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
      ),
    ),
    [materialsOf, normalizedQuery, products],
  )

  return (
    <div className="dashboard-app product-management-layout">
      <Sidebar activeRoute="product-management" onNavigate={onNavigate} />

      <main className="recipe-library-page">
        <header className="recipe-library-header">
          <div>
            <h1>제품 관리</h1>
            <p>제품과 표준 배합을 등록하고, 규격·판매 정보를 관리합니다.</p>
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
            <h2 id="recipe-library-title">제품 목록</h2>
            <span>총 {filteredProducts.length}개 제품</span>
          </div>

          <div className="recipe-card-grid">
            {filteredProducts.map((product) => (
              <article className="recipe-card" key={product.id}>
                <div className="recipe-card__body">
                  <div className="recipe-card__info">
                    <h3>{product.name}</h3>
                    {/* 출처를 함께 적는다. 실적과 표준 배합은 값이 다른 자료다 */}
                    {materialsOf(product).names.length > 0 ? (
                      <div className="recipe-card__materials">
                        <span className="recipe-card__materials-label">
                          투입 재료 {materialsOf(product).names.length}종
                          <em>{materialsOf(product).source}</em>
                        </span>
                        <ul className="recipe-card__material-list">
                          {materialsOf(product).names.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="recipe-card__materials-empty">등록된 투입 재료가 없습니다.</p>
                    )}
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
                  <button
                    type="button"
                    className="recipe-card__detail-button"
                    aria-label={`${product.name} 원가 상세 보기`}
                    onClick={() => onSelectProduct(product.id)}
                  >
                    <Icon name="chevron-right" size={18} />
                    <span>제품 상세보기</span>
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

        {/*
          숨긴 제품. 과거 원가가 FK 로 참조 중이라 지우지 못하고 숨긴 것들이라
          되돌릴 길이 없으면 영영 묻힌다.
        */}
        {hiddenProducts.length > 0 && onRestoreProduct && (
          <section className="hidden-products" aria-labelledby="hidden-products-title">
            <header>
              <div>
                <h2 id="hidden-products-title">숨긴 제품</h2>
                <p>목록에서 감춘 제품입니다. 과거 원가 기록은 그대로 남아 있습니다.</p>
              </div>
              <span className="hidden-products__count">{hiddenProducts.length}개</span>
            </header>
            <ul>
              {hiddenProducts.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                  </div>
                  <div className="hidden-products__actions">
                    <button
                      type="button"
                      disabled={busyId === product.id}
                      onClick={() => {
                        setBusyId(product.id)
                        void onRestoreProduct(product.id).finally(() => setBusyId(''))
                      }}
                    >
                      <Icon name="chevron-left" size={14} />
                      {busyId === product.id ? '처리 중…' : '되돌리기'}
                    </button>
                    {onDeleteProduct && (
                      <button
                        type="button"
                        className="hidden-products__delete"
                        disabled={busyId === product.id}
                        onClick={() => {
                          setBusyId(product.id)
                          void onDeleteProduct(product.id).finally(() => setBusyId(''))
                        }}
                      >
                        <Icon name="trash" size={14} /> 완전 삭제
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

      </main>
    </div>
  )
}
