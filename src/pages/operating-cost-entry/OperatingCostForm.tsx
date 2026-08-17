import { Icon, type IconName } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import type { RecipeProduct } from '../product-management/productManagementData'
import {
  distributeByProduction,
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
  laborTotal?: string
  onEqualize?: () => void
}

function ProductFeeList({
  products,
  values,
  onChange,
  title,
  unit = '원',
  showShareTotal = false,
  laborTotal,
  onEqualize,
}: ProductFeeListProps) {
  const shareTotal = sumProductFees(values)
  const isValid = Math.round(shareTotal * 10) / 10 === 100
  const laborTotalNum = toWonNumber(laborTotal ?? '0')

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
            const perProductLabor = laborTotalNum * (share / 100)
            return (
              <label className="operating-cost-field" key={product.id}>
                <span className="operating-cost-field__label">
                  {product.name}
                  {showShareTotal && (
                    <em className="operating-cost-field__amount">인건비 {formatWon(Math.round(perProductLabor))}</em>
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
  onRemoveCustomItem,
}: OperatingCostFormProps) {
  const productNameById = new Map(products.map((product) => [product.id, product.name]))
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
              products={products}
              values={costs.productFees}
              onChange={onProductFeeChange}
              title="제품별 가공비"
              unit="%"
              showShareTotal
              laborTotal={costs.laborTotal}
              onEqualize={onEqualizeProductFees}
            />
          </div>
        </section>

        {costs.customItems.map((item) => {
          const itemTotal = toWonNumber(item.total)
          const allocation = distributeByProduction(itemTotal, productions)
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
                <div className="operating-cost-labor__products">
                  <div className="operating-cost-labor__products-head">
                    <span className="operating-cost-labor__products-title">제품별 배분 (생산량 기준)</span>
                  </div>
                  <div className="operating-cost-labor__products-list">
                    {productions.length > 0 ? (
                      productions.map((production) => (
                        <div className="operating-cost-alloc" key={production.id}>
                          <span className="operating-cost-alloc__name">
                            {productNameById.get(production.id) ?? production.id}
                          </span>
                          <span className="operating-cost-alloc__amount">
                            {formatWon(allocation[production.id] ?? 0)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="operating-cost-labor__empty">등록된 제품이 없습니다.</p>
                    )}
                  </div>
                </div>
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
