import { useRef } from 'react'
import { Icon } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { parseNumber } from '../../utils/number'
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
    productName, setProductName,
    imageUrl, setImageUrl,
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    newIngredientName, setNewIngredientName, newIngredientPrice, setNewIngredientPrice,
    newIngredientUnit, setNewIngredientUnit,
    addIngredient, addNewIngredient, updateUsage, updateUnitPrice, removeIngredient,
    saveRecipe,
  } = recipe

  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onAction('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      onAction('이미지 용량은 3MB 이하만 가능합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImageUrl(String(reader.result))
    reader.onerror = () => onAction('사진을 읽는 중 문제가 발생했습니다.')
    reader.readAsDataURL(file)
  }

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
              <div className="product-info-body">
                <div className="product-info-fields">
                  <label>제품명<input required value={productName} placeholder="예: 포기김치 5kg" onChange={(event) => setProductName(event.target.value)} /></label>
                </div>
                <div className="product-info-photo">
                  <button
                    type="button"
                    className="product-info-photo__thumb"
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="제품 사진 추가"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="제품 사진 미리보기" />
                    ) : (
                      <span className="product-info-photo__placeholder">
                        <Icon name="upload" size={18} />
                        <small>사진 추가</small>
                      </span>
                    )}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      className="product-info-photo__remove"
                      onClick={() => setImageUrl('')}
                    >
                      <Icon name="trash" size={13} /> 사진 제거
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelected}
                  />
                </div>
              </div>
            </section>

            <section className="recipe-builder-section" aria-labelledby="ingredient-search-title">
              <div className="recipe-builder-section__heading">
                <span>02</span>
                <div><h2 id="ingredient-search-title">재료 추가</h2><p>기존 재료를 검색하거나 새 재료를 직접 만드세요.</p></div>
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

              <div className="new-ingredient">
                <h3>새 재료 만들기</h3>
                <div className="new-ingredient__fields">
                  <label>
                    <span>재료명</span>
                    <input
                      value={newIngredientName}
                      placeholder="예: 양파"
                      onChange={(event) => setNewIngredientName(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>단가(원)</span>
                    <NumberInput
                      min="0"
                      value={newIngredientPrice}
                      placeholder="0"
                      onValueChange={(raw) => setNewIngredientPrice(raw)}
                    />
                  </label>
                  <label>
                    <span>단위</span>
                    <select value={newIngredientUnit} onChange={(event) => setNewIngredientUnit(event.target.value as 'kg' | 'g')}>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                    </select>
                  </label>
                  <button
                    className="new-ingredient__add"
                    type="button"
                    onClick={() => onAction(addNewIngredient() ? '새 재료를 추가했습니다.' : '재료명과 단가를 확인해 주세요.')}
                  >
                    <Icon name="add" size={16} /> 추가
                  </button>
                </div>
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
                      <label><span>수량(kg)</span><NumberInput aria-label={`${ingredient.name} 수량(kg)`} min="0" value={ingredient.usage} onValueChange={(raw) => updateUsage(ingredient.id, parseNumber(raw))} /><em>kg</em></label>
                      <label><span>단가(원)</span><NumberInput aria-label={`${ingredient.name} 단가(원)`} min="0" value={ingredient.unitPrice} onValueChange={(raw) => updateUnitPrice(ingredient.id, parseNumber(raw))} /><em>원</em></label>
                      <b>{currencyFormatter.format(ingredient.unitPrice * ingredient.usage)}</b>
                      <button type="button" aria-label={`${ingredient.name} 삭제`} onClick={() => removeIngredient(ingredient.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          <div className="recipe-builder__submit">
            <button type="submit" disabled={!productName.trim() || selectedIngredients.length === 0}>
              레시피 저장
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
