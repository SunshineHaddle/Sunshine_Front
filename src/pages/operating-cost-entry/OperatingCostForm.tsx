import { Icon, type IconName } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import type { RecipeProduct } from '../product-management/productManagementData'
import {
  formatWon,
  sumProductFees,
  toWonNumber,
  type CostField,
  type OperatingCosts,
} from './operatingCostModel'

type ProductionShare = { id: string; production: number }

type OperatingCostFormProps = {
  products: RecipeProduct[]
  costs: OperatingCosts
  productions: ProductionShare[]
  onCostChange: (field: CostField, value: string) => void
  onProductFeeChange: (productId: string, value: string) => void
  onEqualizeProductFees: () => void
  onAddCustomItem: () => void
  onUpdateCustomItemName: (id: string, name: string) => void
  onUpdateCustomItemTotal: (id: string, value: string) => void
  onUpdateCustomItemShare: (id: string, productId: string, value: string) => void
  onEqualizeCustomItemShares: (id: string) => void
  onRemoveCustomItem: (id: string) => void
}

type CostInputProps = {
  field: CostField
  label: string
  value: string
  icon?: IconName
  suffix?: string
  onChange: (field: CostField, value: string) => void
}

function CostInput({ field, label, value, icon, suffix, onChange }: CostInputProps) {
  return (
    <label className="operating-cost-field">
      <span>{label}</span>
      <span className="operating-cost-input">
        {icon && <Icon name={icon} size={16} />}
        <NumberInput value={value} onValueChange={(raw) => onChange(field, raw)} />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

type ProductFeeListProps = {
  products: RecipeProduct[]
  values: Record<string, string>
  onChange: (productId: string, value: string) => void
  title: string
  unit?: string
  showShareTotal?: boolean
  /** 비율을 곱할 총액. 제품마다 환산 금액을 함께 보여준다 */
  totalAmount?: string
  /** 환산 금액 앞에 붙일 말 (인건비 섹션은 '인건비', 추가 항목은 생략) */
  amountLabel?: string
  onEqualize?: () => void
}

function ProductFeeList({
  products,
  values,
  onChange,
  title,
  unit = '원',
  showShareTotal = false,
  totalAmount,
  amountLabel,
  onEqualize,
}: ProductFeeListProps) {
  const shareTotal = sumProductFees(values)
  const isValid = Math.round(shareTotal * 10) / 10 === 100
  const totalAmountNum = toWonNumber(totalAmount ?? '0')

  return (
    <div className="operating-cost-labor__products">
      <div className="operating-cost-labor__products-head">
        <span className="operating-cost-labor__products-title">{title}</span>
        {showShareTotal && (
          <div className="operating-cost-labor__products-actions">
            {onEqualize && (
              <button type="button" className="operating-cost-labor__equalize" onClick={onEqualize}>
                균등 분배
              </button>
            )}
            <span className={`operating-cost-labor__share-total${isValid ? ' is-valid' : ''}`}>
              합계 {shareTotal.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}% / 100%
            </span>
          </div>
        )}
      </div>
      <div className="operating-cost-labor__products-list">
        {products.length > 0 ? (
          products.map((product) => {
            const share = Number(values[product.id]) || 0
            const perProductAmount = totalAmountNum * (share / 100)
            return (
              <label className="operating-cost-field" key={product.id}>
                <span className="operating-cost-field__label">
                  {product.name}
                  {showShareTotal && (
                    <em className="operating-cost-field__amount">
                      {amountLabel ? `${amountLabel} ` : ''}{formatWon(Math.round(perProductAmount))}
                    </em>
                  )}
                </span>
                <span className="operating-cost-input">
                  <input
                    min="0"
                    type="number"
                    value={values[product.id] ?? ''}
                    onChange={(event) => onChange(product.id, event.target.value)}
                  />
                  <small>{unit}</small>
                </span>
              </label>
            )
          })
        ) : (
          <p className="operating-cost-labor__empty">등록된 제품이 없습니다.</p>
        )}
      </div>
      {showShareTotal && !isValid && (
        <p className="operating-cost-labor__share-warning">제품별 비율의 합이 100%가 되어야 합니다.</p>
      )}
    </div>
  )
}

export function OperatingCostForm({
  products,
  costs,
  productions,
  onCostChange,
  onProductFeeChange,
  onEqualizeProductFees,
  onAddCustomItem,
  onUpdateCustomItemName,
  onUpdateCustomItemTotal,
  onUpdateCustomItemShare,
  onEqualizeCustomItemShares,
  onRemoveCustomItem,
}: OperatingCostFormProps) {
  // 1단계 엑셀에 넣은 제품만 대상 (인건비·커스텀 항목 모두 동일)
  const excelProductIds = new Set(productions.map((p) => p.id))
  const excelProducts = products.filter((product) => excelProductIds.has(product.id))
  return (
    <>
      <div className="operating-cost-groups">
        <section className="operating-cost-group operating-cost-group--wide" aria-labelledby="labor-cost-title">
          <header><Icon name="users" size={18} /><h2 id="labor-cost-title">인건비</h2></header>
          <div className="operating-cost-labor">
            <div className="operating-cost-labor__total">
              <CostInput field="laborTotal" label="총 인건비" value={costs.laborTotal} suffix="원" onChange={onCostChange} />
            </div>
            <ProductFeeList
              products={excelProducts}
              values={costs.productFees}
              onChange={onProductFeeChange}
              title="제품별 가공비"
              unit="%"
              showShareTotal
              totalAmount={costs.laborTotal}
              amountLabel="인건비"
              onEqualize={onEqualizeProductFees}
            />
          </div>
        </section>

        {costs.customItems.map((item) => {
          return (
            <section className="operating-cost-group operating-cost-group--wide operating-cost-group--custom" key={item.id}>
              <header>
                <Icon name="landmark" size={18} />
                <input
                  className="operating-cost-group__name-input"
                  type="text"
                  value={item.name}
                  placeholder="항목 이름"
                  onChange={(event) => onUpdateCustomItemName(item.id, event.target.value)}
                />
                <button
                  type="button"
                  className="operating-cost-group__remove"
                  aria-label="항목 삭제"
                  onClick={() => onRemoveCustomItem(item.id)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </header>
              <div className="operating-cost-labor">
                <div className="operating-cost-labor__total">
                  <label className="operating-cost-field">
                    <span>항목 비용</span>
                    <span className="operating-cost-input">
                      <NumberInput
                        value={item.total}
                        onValueChange={(raw) => onUpdateCustomItemTotal(item.id, raw)}
                      />
                      <small>원</small>
                    </span>
                  </label>
                </div>
                <ProductFeeList
                  products={excelProducts}
                  values={item.shares}
                  onChange={(productId, value) => onUpdateCustomItemShare(item.id, productId, value)}
                  title="제품별 배분"
                  unit="%"
                  showShareTotal
                  totalAmount={item.total}
                  onEqualize={() => onEqualizeCustomItemShares(item.id)}
                />
              </div>
            </section>
          )
        })}
      </div>

      <button type="button" className="operating-cost-add" onClick={onAddCustomItem}>
        <Icon name="add" size={16} /> 항목 추가
      </button>
    </>
  )
}
