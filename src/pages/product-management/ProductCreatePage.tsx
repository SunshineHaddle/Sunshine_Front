import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'
import { useProductRecipeForm } from './useProductRecipeForm'

type ProductCreatePageProps = {
  nextProductNumber: number
  onNavigate: (route: AppRoute) => void
  onCreate: (product: RecipeProduct) => void
  onAction: (message: string) => void
}

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 4,
})

export function ProductCreatePage({
  nextProductNumber,
  onNavigate,
  onCreate,
  onAction,
}: ProductCreatePageProps) {
  const recipe = useProductRecipeForm({ nextProductNumber, onCreate })
  const {
    productName, setProductName, description, setDescription,
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    hourlyWage, setHourlyWage, laborHours, setLaborHours, indirectCosts, hasDefaultRecipe,
    totalMaterialCost, laborCost, totalIndirectCost, totalCost,
    addIngredient, updateUsage, updateUnitPrice, removeIngredient, updateIndirectCost,
    saveDefaultRecipe, loadDefaultRecipe, saveRecipe,
  } = recipe

  return (
    <div className="dashboard-app product-management-layout">
      <Sidebar activeRoute="product-create" onNavigate={onNavigate} />

      <main className="product-create-page">
        <button className="product-create-back" type="button" onClick={() => onNavigate('product-management')}>
          <Icon name="chevron-left" size={16} /> 제품 목록
        </button>

        <header className="product-create-header">
          <h1>새 제품 레시피</h1>
          <p>제품을 정의하고 필요한 재료와 사용량을 추가하세요.</p>
        </header>

        <form className="recipe-builder" onSubmit={saveRecipe}>
          <div className="recipe-builder__main">
            <section className="recipe-builder-section" aria-labelledby="product-info-title">
              <div className="recipe-builder-section__heading">
                <span>01</span>
                <div><h2 id="product-info-title">제품 정보</h2><p>생성할 제품의 기본 정보를 입력합니다.</p></div>
              </div>
              <div className="product-info-fields">
                <label>제품명<input required value={productName} placeholder="예: 포기김치 5kg" onChange={(event) => setProductName(event.target.value)} /></label>
                <label>설명<input value={description} placeholder="레시피를 구분할 간단한 설명" onChange={(event) => setDescription(event.target.value)} /></label>
              </div>
            </section>

            <section className="recipe-builder-section" aria-labelledby="ingredient-search-title">
              <div className="recipe-builder-section__heading">
                <span>02</span>
                <div><h2 id="ingredient-search-title">재료 추가</h2><p>재료를 검색하고 + 버튼으로 담으세요.</p></div>
                <button
                  className="recipe-default-load"
                  type="button"
                  disabled={!hasDefaultRecipe}
                  onClick={() => onAction(loadDefaultRecipe() ? '기본 레시피를 불러왔습니다.' : '저장된 기본 레시피가 없습니다.')}
                >
                  불러오기
                </button>
              </div>
              <label className="ingredient-search-field">
                <Icon name="search" size={17} />
                <span className="visually-hidden">재료 검색</span>
                <input value={ingredientQuery} placeholder="재료명 검색" onChange={(event) => setIngredientQuery(event.target.value)} />
              </label>
              <div className="ingredient-catalog">
                {availableIngredients.slice(0, 5).map((ingredient) => (
                  <div key={ingredient.id}>
                    <span><strong>{ingredient.name}</strong><small>{currencyFormatter.format(ingredient.unitPrice)} / {ingredient.unit}</small></span>
                    <button type="button" aria-label={`${ingredient.name} 추가`} onClick={() => addIngredient(ingredient)}><Icon name="add" size={16} /></button>
                  </div>
                ))}
                {availableIngredients.length === 0 && <p>추가할 수 있는 재료가 없습니다.</p>}
              </div>
              <div className="recipe-default-actions">
                <button
                  type="button"
                  disabled={selectedIngredients.length === 0}
                  onClick={() => onAction(saveDefaultRecipe() ? '기본 레시피를 저장했습니다.' : '기본 레시피를 저장하지 못했습니다.')}
                >
                  기본 레시피로 저장
                </button>
              </div>
            </section>

            <section className="recipe-builder-section recipe-cart" aria-labelledby="recipe-cart-title">
              <div className="recipe-builder-section__heading">
                <span>03</span>
                <div><h2 id="recipe-cart-title">추가된 재료</h2><p>수량은 kg, 단가는 원 기준이며 소수점 입력이 가능합니다.</p></div>
              </div>
              {selectedIngredients.length === 0 ? (
                <div className="recipe-cart__empty"><Icon name="box" size={22} /><p>추가된 재료가 없습니다.</p></div>
              ) : (
                <div className="recipe-cart__items">
                  <div className="recipe-cart__labels" aria-hidden="true">
                    <span>품명</span>
                    <span>수량(kg)</span>
                    <span>단가(원)</span>
                    <span>금액(원)</span>
                    <span>관리</span>
                  </div>
                  {selectedIngredients.map((ingredient) => (
                    <div className="recipe-cart-item" key={ingredient.id}>
                      <div><strong>{ingredient.name}</strong></div>
                      <label><span>수량(kg)</span><input aria-label={`${ingredient.name} 수량(kg)`} min="0" step="any" type="number" value={ingredient.usage} onChange={(event) => updateUsage(ingredient.id, Number(event.target.value))} /><em>kg</em></label>
                      <label><span>단가(원)</span><input aria-label={`${ingredient.name} 단가(원)`} min="0" step="any" type="number" value={ingredient.unitPrice} onChange={(event) => updateUnitPrice(ingredient.id, Number(event.target.value))} /><em>원</em></label>
                      <b>{currencyFormatter.format(ingredient.unitPrice * ingredient.usage)}</b>
                      <button type="button" aria-label={`${ingredient.name} 삭제`} onClick={() => removeIngredient(ingredient.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="recipe-builder-section recipe-extra-costs" aria-labelledby="extra-cost-title">
              <div className="recipe-builder-section__heading">
                <span>04</span>
                <div><h2 id="extra-cost-title">인건비 및 기타 간접비</h2><p>제품 1개 생산에 배분되는 비용을 입력합니다.</p></div>
              </div>
              <div className="extra-cost-fields">
                <label>시간당 인건비<input min="0" type="number" value={hourlyWage} onChange={(event) => setHourlyWage(Math.max(0, Number(event.target.value)))} /><span>원</span></label>
                <label>작업 시간<input min="0" step="0.1" type="number" value={laborHours} onChange={(event) => setLaborHours(Math.max(0, Number(event.target.value)))} /><span>시간</span></label>
                <label>전기세<input min="0" type="number" value={indirectCosts.electricity} onChange={(event) => updateIndirectCost('electricity', Number(event.target.value))} /><span>원</span></label>
                <label>식대<input min="0" type="number" value={indirectCosts.meal} onChange={(event) => updateIndirectCost('meal', Number(event.target.value))} /><span>원</span></label>
                <label>이자 비용<input min="0" type="number" value={indirectCosts.interest} onChange={(event) => updateIndirectCost('interest', Number(event.target.value))} /><span>원</span></label>
              </div>
            </section>
          </div>

          <aside className="cost-preview" aria-labelledby="cost-preview-title">
            <span className="cost-preview__label">원가 미리보기</span>
            <h2 id="cost-preview-title">{productName || '새 제품'}</h2>
            <p>입력한 사용량을 기준으로 자동 계산됩니다.</p>
            <dl>
              <div><dt>재료 수</dt><dd>{selectedIngredients.length}개</dd></div>
              <div><dt>원재료비</dt><dd>{currencyFormatter.format(totalMaterialCost)}</dd></div>
              <div><dt>인건비</dt><dd>{currencyFormatter.format(laborCost)}</dd></div>
              <div><dt>기타 간접비</dt><dd>{currencyFormatter.format(totalIndirectCost)}</dd></div>
              <div className="cost-preview__total"><dt>예상 총원가</dt><dd>{currencyFormatter.format(totalCost)}</dd></div>
            </dl>
            <button type="submit" disabled={!productName.trim() || selectedIngredients.length === 0}>레시피 저장</button>
            <small>운영비와 포장비는 이후 단계에서 반영할 수 있습니다.</small>
          </aside>
        </form>
      </main>
    </div>
  )
}
