import { useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { IngredientCatalogItem, RecipeProduct } from './productManagementData'
import { ProductCostSummary } from '../../components/product-management/ProductCostSummary'
import { useProductCostAnalysis } from '../../components/product-management/useProductCostAnalysis'
import { NumberInput } from '../../components/common/NumberInput'
import { saveRecipeItems, updateProduct, uploadProductImage } from '../../lib/api/products'
import { describeDbError } from '../../lib/api/errors'
import { thumbnailUrl } from '../../utils/thumbnail'

type ProductDetailPageProps = {
  product: RecipeProduct
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  onUpdateImage?: (imageUrl: string) => void
  /** DB 원재료 목록(§2-1). 배합 수정에서 재료를 고를 때 쓴다 */
  catalog?: IngredientCatalogItem[]
  /** 저장 후 제품 목록을 다시 읽는다 */
  onRefresh?: () => Promise<void>
  /** §3-7 제품 비활성화 */
  onDeactivate?: () => Promise<void>
}

/** 화면 입력은 문자열로 들고 있다가 저장 시 숫자로 바꾼다 */
type RecipeRow = {
  materialId: string
  name: string
  usage: string
  unitPrice: string
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

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

export function ProductDetailPage({
  product,
  onNavigate,
  onAction,
  onUpdateImage,
  catalog = [],
  onRefresh,
  onDeactivate,
}: ProductDetailPageProps) {
  const analysisState = useProductCostAnalysis(product)

  // ── §3-6 배합 수정 ────────────────────────────────────────
  const [isEditingRecipe, setIsEditingRecipe] = useState(false)

  /**
   * 판매 정보. 지금까지 입력 화면이 없어 SQL 로만 넣을 수 있었다.
   * unit_weight_kg 가 비면 마감 계산이 1kg 으로 간주해 마진율이 과대 계상된다.
   */
  const [sales, setSales] = useState({
    salePrice: String(product.salePrice ?? ''),
    unitWeightKg: String(product.unitWeightKg ?? ''),
  })
  const [savingSales, setSavingSales] = useState(false)

  const saveSales = async () => {
    setSavingSales(true)
    try {
      const weight = sales.unitWeightKg.trim()
      // 빈 값은 0 이 아니라 null 로 보낸다 — 0 이면 단위원가가 0 이 된다
      const weightKg = weight === '' ? null : Number(weight) || null
      await updateProduct(product.id, {
        sale_price: Number(sales.salePrice) || 0,
        unit_weight_kg: weightKg,
        // 규격은 표시용 라벨이라 무게에서 만들어 쓴다.
        // 따로 입력받으면 '5kg' 인데 무게는 3 처럼 둘이 어긋날 수 있다.
        specification: weightKg === null ? '' : `${weightKg}kg`,
      })
      await onRefresh?.()
      onAction(`${product.name}의 판매 정보를 저장했습니다.`)
    } catch (error) {
      onAction(`판매 정보 저장 실패: ${describeDbError(error)}`)
    } finally {
      setSavingSales(false)
    }
  }
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([])
  const [savingRecipe, setSavingRecipe] = useState(false)

  const startEditRecipe = () => {
    setRecipeRows(
      product.ingredients.flatMap((ingredient) =>
        ingredient.materialId
          ? [{
              materialId: ingredient.materialId,
              name: ingredient.name,
              usage: String(ingredient.usage),
              unitPrice: String(ingredient.unitPrice ?? 0),
            }]
          : [],
      ),
    )
    setIsEditingRecipe(true)
  }

  const updateRecipeRow = (materialId: string, patch: Partial<RecipeRow>) => {
    setRecipeRows((current) =>
      current.map((row) => (row.materialId === materialId ? { ...row, ...patch } : row)),
    )
  }

  const addRecipeRow = (item: IngredientCatalogItem) => {
    if (recipeRows.some((row) => row.materialId === item.id)) return
    setRecipeRows((current) => [
      ...current,
      { materialId: item.id, name: item.name, usage: '0', unitPrice: String(item.unitPrice) },
    ])
  }

  const saveRecipe = async () => {
    setSavingRecipe(true)
    try {
      await saveRecipeItems(
        product.id,
        recipeRows.map((row) => ({
          materialId: row.materialId,
          usage: Number(row.usage) || 0,
          unit: 'kg' as const,
          unitPrice: Number(row.unitPrice) || 0,
        })),
      )
      await onRefresh?.()
      setIsEditingRecipe(false)
      onAction('배합을 저장했습니다.')
    } catch (error) {
      onAction(`배합 저장 실패: ${describeDbError(error)}`)
    } finally {
      setSavingRecipe(false)
    }
  }

  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const totalCost = product.materialCost + product.laborCost + indirectCost

  const sharePercent = (amount: number) => (totalCost > 0 ? (amount / totalCost) * 100 : 0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEditingImage, setIsEditingImage] = useState(false)

  const canEditImage = Boolean(onUpdateImage)

  /** §3-5 : base64 로 DB 에 밀어넣지 않고 Storage 에 올린 뒤 공개 URL 을 저장한다 */
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onAction('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onAction('이미지 용량은 3MB 이하만 가능합니다.')
      return
    }

    try {
      const publicUrl = await uploadProductImage(product.id, file)
      onUpdateImage?.(publicUrl)
      setIsEditingImage(false)
      onAction(`${product.name} 사진을 변경했습니다.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      onAction(
        message.includes('Bucket not found')
          ? 'Supabase Storage 에 product-images 버킷을 먼저 만들어주세요.'
          : `사진 업로드 실패: ${message}`,
      )
    }
  }

  const removeImage = () => {
    onUpdateImage?.('')
    setIsEditingImage(false)
    onAction(`${product.name} 사진을 제거했습니다.`)
  }

  return (
    <div className="dashboard-app product-management-layout">
      <Sidebar activeRoute="product-detail" onNavigate={onNavigate} />

      <main className="product-detail-page">
        <div className="product-detail-topbar">
          <button className="product-create-back" type="button" onClick={() => onNavigate('product-management')}>
            <Icon name="chevron-left" size={16} /> 제품 목록
          </button>
          {onDeactivate && (
            // §3-7 : 과거 원가 스냅샷이 FK 로 참조하므로 삭제가 아니라 비활성화한다
            <button
              className="product-deactivate"
              type="button"
              onClick={() => {
                if (!window.confirm(`${product.name}을(를) 목록에서 숨길까요?\n과거 원가 기록은 그대로 남습니다.`)) return
                void onDeactivate().catch((error: unknown) =>
                  onAction(`처리 실패: ${describeDbError(error)}`),
                )
              }}
            >
              <Icon name="trash" size={14} /> 제품 삭제
            </button>
          )}
        </div>

        <header className="product-detail-header">
          <div className="product-detail-header__photo-wrap">
            <span className="product-detail-header__photo">
              {product.imageUrl
                ? <img src={thumbnailUrl(product.imageUrl, 320)} alt={`${product.name} 사진`} loading="lazy" decoding="async" width={72} height={72} />
                : <span className="product-detail-header__photo-fallback">{product.name.slice(0, 1)}</span>}
            </span>
            {canEditImage && (
              <button
                type="button"
                className="product-detail-header__photo-edit"
                aria-label="제품 사진 변경"
                aria-expanded={isEditingImage}
                onClick={() => setIsEditingImage((current) => !current)}
              >
                <Icon name="edit" size={13} />
              </button>
            )}

            {isEditingImage && (
              <div className="product-detail-header__photo-menu" role="dialog" aria-label="제품 사진 변경">
                <button
                  type="button"
                  className="photo-menu__upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="upload" size={14} /> 사진 업로드
                </button>
                {product.imageUrl && (
                  <button type="button" className="photo-menu__remove" onClick={removeImage}>
                    <Icon name="trash" size={14} /> 사진 제거
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>

          <div>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
          </div>
        </header>

        <header className="product-cost-analysis__header">
          <div>
            <p className="product-cost-analysis__eyebrow">COST ANALYSIS</p>
            <h2 id="product-cost-analysis-title">제품별 월간 원가 분석</h2>
            <span>선택한 제품의 상세 원가 지표와 변동 추이를 분석합니다.</span>
          </div>
        </header>

        <section className="sales-info-panel" aria-labelledby="sales-info-title">
          <header className="sales-info-panel__head">
            <div>
              <h2 id="sales-info-title">판매 정보</h2>
              <p>마진율 계산에 쓰입니다. 포장 1개를 기준으로 입력하세요.</p>
            </div>
            <button
              type="button"
              className="sales-info-panel__save"
              onClick={() => void saveSales()}
              disabled={savingSales}
            >
              {savingSales ? '저장 중…' : '저장'}
            </button>
          </header>

          <div className="sales-info-panel__fields">
            <label>
              <span>판매가 (원)</span>
              <NumberInput
                min="0"
                value={sales.salePrice}
                placeholder="예: 28900"
                onValueChange={(raw) => setSales((c) => ({ ...c, salePrice: raw }))}
              />
            </label>
            <label>
              <span>포장 1개 무게 (kg)</span>
              <NumberInput
                min="0"
                value={sales.unitWeightKg}
                placeholder="예: 5"
                onValueChange={(raw) => setSales((c) => ({ ...c, unitWeightKg: raw }))}
              />
              <small className="sales-info-panel__hint">
                {sales.unitWeightKg.trim()
                  ? `규격은 ${Number(sales.unitWeightKg) || 0}kg 으로 저장됩니다`
                  : '수익성 표의 규격도 이 값으로 표시됩니다'}
              </small>
            </label>
          </div>

          {!sales.unitWeightKg.trim() && (
            <p className="sales-info-panel__warning">
              포장 무게가 비어 있습니다. 이대로 마감하면 <strong>1kg 포장</strong>으로 계산되어
              마진율이 실제보다 크게 나옵니다.
            </p>
          )}
        </section>

        <ProductCostSummary product={product} state={analysisState} onAction={onAction} />

        <div className="product-detail-grid">
          <section className="product-cost-panel" aria-labelledby="material-cost-title">
            <header>
              <div><h2 id="material-cost-title">원재료비 상세</h2><p>레시피 사용량 기준 재료별 비용입니다.</p></div>
              {isEditingRecipe ? (
                <div className="recipe-edit-actions">
                  <button type="button" onClick={() => setIsEditingRecipe(false)} disabled={savingRecipe}>취소</button>
                  <button type="button" className="is-primary" onClick={() => void saveRecipe()} disabled={savingRecipe}>
                    {savingRecipe ? '저장 중…' : '배합 저장'}
                  </button>
                </div>
              ) : (
                <div className="recipe-edit-actions">
                  <button type="button" onClick={startEditRecipe}>배합 수정</button>
                  <strong>{currencyFormatter.format(product.materialCost)}</strong>
                </div>
              )}
            </header>

            {isEditingRecipe && (
              <div className="recipe-edit">
                <div className="material-cost-list__head"><span>품명</span><span>수량(kg)</span><span>단가(원)</span><span /></div>
                {recipeRows.map((row) => (
                  <div className="recipe-edit__row" key={row.materialId}>
                    <strong>{row.name}</strong>
                    <input type="number" min="0" step="any" aria-label={`${row.name} 수량`}
                      value={row.usage}
                      onChange={(e) => updateRecipeRow(row.materialId, { usage: e.target.value })} />
                    <input type="number" min="0" step="any" aria-label={`${row.name} 단가`}
                      value={row.unitPrice}
                      onChange={(e) => updateRecipeRow(row.materialId, { unitPrice: e.target.value })} />
                    <button type="button" aria-label={`${row.name} 제거`}
                      onClick={() => setRecipeRows((c) => c.filter((r) => r.materialId !== row.materialId))}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
                {recipeRows.length === 0 && <p className="recipe-edit__empty">재료를 추가해주세요.</p>}
                <label className="recipe-edit__add">
                  <span>재료 추가</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const item = catalog.find((c) => c.id === e.target.value)
                      if (item) addRecipeRow(item)
                      e.target.value = ''
                    }}
                  >
                    <option value="">선택…</option>
                    {catalog
                      .filter((item) => !recipeRows.some((row) => row.materialId === item.id))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({numberFormatter.format(item.unitPrice)}원/kg)
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}

            <div className="material-cost-list material-cost-list--with-price" hidden={isEditingRecipe}>
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
      </main>
    </div>
  )
}
