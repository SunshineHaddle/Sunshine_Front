import { useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from './productManagementData'
import { ProductCostSummary } from '../../components/product-management/ProductCostSummary'
import { useProductCostAnalysis } from '../../components/product-management/useProductCostAnalysis'

type ProductDetailPageProps = {
  product: RecipeProduct
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  onUpdateImage?: (imageUrl: string) => void
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

export function ProductDetailPage({ product, onNavigate, onAction, onUpdateImage }: ProductDetailPageProps) {
  const analysisState = useProductCostAnalysis(product)

  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const totalCost = product.materialCost + product.laborCost + indirectCost

  const sharePercent = (amount: number) => (totalCost > 0 ? (amount / totalCost) * 100 : 0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEditingImage, setIsEditingImage] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')

  const canEditImage = Boolean(onUpdateImage)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    const reader = new FileReader()
    reader.onload = () => {
      onUpdateImage?.(String(reader.result))
      setIsEditingImage(false)
      onAction(`${product.name} 사진을 변경했습니다.`)
    }
    reader.onerror = () => onAction('사진을 읽는 중 문제가 발생했습니다.')
    reader.readAsDataURL(file)
  }

  const applyImageUrl = () => {
    const url = imageUrlInput.trim()
    if (!url) {
      onAction('이미지 주소를 입력해 주세요.')
      return
    }
    onUpdateImage?.(url)
    setIsEditingImage(false)
    setImageUrlInput('')
    onAction(`${product.name} 사진을 변경했습니다.`)
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
        <button className="product-create-back" type="button" onClick={() => onNavigate('product-management')}>
          <Icon name="chevron-left" size={16} /> 제품 목록
        </button>

        <header className="product-detail-header">
          <div className="product-detail-header__photo-wrap">
            <span className="product-detail-header__photo">
              {product.imageUrl
                ? <img src={product.imageUrl} alt={`${product.name} 사진`} />
                : <span className="product-detail-header__photo-fallback">{product.name.slice(0, 1)}</span>}
            </span>
            {canEditImage && (
              <button
                type="button"
                className="product-detail-header__photo-edit"
                aria-label="제품 사진 변경"
                aria-expanded={isEditingImage}
                onClick={() => {
                  setImageUrlInput(product.imageUrl ?? '')
                  setIsEditingImage((current) => !current)
                }}
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
                  <Icon name="upload" size={15} /> 사진 업로드
                </button>
                <div className="photo-menu__url">
                  <input
                    type="url"
                    value={imageUrlInput}
                    placeholder="이미지 주소(URL) 붙여넣기"
                    onChange={(event) => setImageUrlInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyImageUrl()
                      if (event.key === 'Escape') setIsEditingImage(false)
                    }}
                  />
                  <button type="button" onClick={applyImageUrl}>적용</button>
                </div>
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
      </main>
    </div>
  )
}
