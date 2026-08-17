import { useRef } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { shrinkImage } from '../../utils/thumbnail'
import type { IngredientCatalogItem, RecipeProduct } from './productManagementData'
import { useProductRecipeForm } from './useProductRecipeForm'

type ProductCreatePageProps = {
  nextProductNumber: number
  onNavigate: (route: AppRoute) => void
  onCreate: (product: RecipeProduct) => void
  onAction: (message: string) => void
  /** DB에서 불러온 원재료 목록(§2-1) */
  catalog?: IngredientCatalogItem[]
}

export function ProductCreatePage({
  nextProductNumber,
  onNavigate,
  onCreate,
  onAction,
  catalog,
}: ProductCreatePageProps) {
  const recipe = useProductRecipeForm({ nextProductNumber, onCreate, catalog })
  const {
    productName, setProductName,
    imageUrl, setImageUrl,
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    newIngredientName, setNewIngredientName,
    addIngredient, addNewIngredient, removeIngredient,
    saveRecipe,
  } = recipe

  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    // 썸네일로만 쓰이므로 최대 512px 로 줄여 data URL 을 작게 만든다
    const small = await shrinkImage(file, 512)
    const reader = new FileReader()
    reader.onload = () => setImageUrl(String(reader.result))
    reader.onerror = () => onAction('사진을 읽는 중 문제가 발생했습니다.')
    reader.readAsDataURL(small)
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
          <p>제품을 정의하고 필요한 재료를 추가하세요.</p>
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
                  <label>제품명<input required value={productName} placeholder="예: 포기김치" onChange={(event) => setProductName(event.target.value)} /></label>
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
                    onChange={(event) => void handleImageSelected(event)}
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
                {availableIngredients.map((ingredient) => (
                  <div key={ingredient.id} className={ingredient.isSuggestion ? 'is-suggestion' : undefined}>
                    <strong>{ingredient.name}</strong>
                    <button
                      type="button"
                      aria-label={`${ingredient.name} 추가`}
                      onClick={() => {
                        void addIngredient(ingredient).then((result) => {
                          if (result.message) onAction(result.message)
                        })
                      }}
                    >
                      <Icon name="add" size={16} />
                    </button>
                  </div>
                ))}
                {availableIngredients.length === 0 && <p>추가할 수 있는 재료가 없습니다.</p>}
              </div>

              <div className="new-ingredient">
                <h3>새 재료 만들기</h3>
                <p className="new-ingredient__hint">
                  재료명만 입력해 추가하세요.
                </p>
                <div className="new-ingredient__fields">
                  <label>
                    <span>재료명</span>
                    <input
                      value={newIngredientName}
                      placeholder="예: 양파"
                      onChange={(event) => setNewIngredientName(event.target.value)}
                    />
                  </label>
                  <button
                    className="new-ingredient__add"
                    type="button"
                    disabled={!newIngredientName.trim()}
                    onClick={() => { void addNewIngredient().then((result) => onAction(result.message)) }}
                  >
                    <Icon name="add" size={16} /> 추가
                  </button>
                </div>
              </div>
            </section>

            <section className="recipe-builder-section recipe-cart" aria-labelledby="recipe-cart-title">
              <div className="recipe-builder-section__heading">
                <span>03</span>
                <div><h2 id="recipe-cart-title">추가된 재료</h2><p>제품에 사용할 재료명을 확인하세요.</p></div>
              </div>
              {selectedIngredients.length === 0 ? (
                <div className="recipe-cart__empty"><Icon name="box" size={22} /><p>추가된 재료가 없습니다.</p></div>
              ) : (
                <div className="recipe-cart__items">
                  <div className="recipe-cart__labels" aria-hidden="true">
                    <span>재료명</span>
                    <span>관리</span>
                  </div>
                  {selectedIngredients.map((ingredient) => (
                    <div className="recipe-cart-item" key={ingredient.id}>
                      <strong>{ingredient.name}</strong>
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
