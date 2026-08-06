import { Icon, type IconName } from '../../components/common/Icon'
import type { RecipeProduct } from '../product-management/productManagementData'
import {
  formatWon,
  toWonNumber,
  type CostField,
  type OperatingCosts,
} from './operatingCostModel'

type CostTotals = {
  laborCost: number
  utilityCost: number
  indirectCost: number
  totalCost: number
}

type OperatingCostFormProps = {
  products: RecipeProduct[]
  costs: OperatingCosts
  totals: CostTotals
  onCostChange: (field: CostField, value: string) => void
  onProductFeeChange: (productId: string, value: string) => void
  onAddCustomItem: () => void
  onUpdateCustomItem: (id: string, patch: { name?: string; amount?: string }) => void
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
        <input min="0" type="number" value={value} onChange={(event) => onChange(field, event.target.value)} />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

export function OperatingCostForm({
  products,
  costs,
  totals,
  onCostChange,
  onProductFeeChange,
  onAddCustomItem,
  onUpdateCustomItem,
  onRemoveCustomItem,
}: OperatingCostFormProps) {
  const productCount = products.length || 1
  const electricityPerProduct = toWonNumber(costs.electricity) / productCount
  const waterPerProduct = toWonNumber(costs.water) / productCount

  return (
    <>
      <section className="operating-cost-group operating-cost-group--wide" aria-labelledby="labor-cost-title">
        <header><Icon name="users" size={18} /><h2 id="labor-cost-title">인건비</h2></header>
        <div className="operating-cost-labor">
          <div className="operating-cost-labor__total">
            <CostInput field="laborTotal" label="총 인건비" value={costs.laborTotal} suffix="원" onChange={onCostChange} />
          </div>
          <div className="operating-cost-labor__products">
            <span className="operating-cost-labor__products-title">제품별 가공비</span>
            <div className="operating-cost-labor__products-list">
              {products.length > 0 ? (
                products.map((product) => (
                  <label className="operating-cost-field" key={product.id}>
                    <span>{product.name}</span>
                    <span className="operating-cost-input">
                      <input
                        min="0"
                        type="number"
                        value={costs.productFees[product.id] ?? ''}
                        onChange={(event) => onProductFeeChange(product.id, event.target.value)}
                      />
                      <small>원</small>
                    </span>
                  </label>
                ))
              ) : (
                <p className="operating-cost-labor__empty">등록된 제품이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="operating-cost-groups operating-cost-groups--utility">
        <section className="operating-cost-group" aria-labelledby="electricity-cost-title">
          <header><Icon name="bolt" size={18} /><h2 id="electricity-cost-title">전기세</h2></header>
          <div className="operating-cost-group__fields">
            <CostInput field="electricity" label="전기요금 (₩)" value={costs.electricity} icon="bolt" suffix="원" onChange={onCostChange} />
          </div>
          <p className="operating-cost-group__per-product">
            <span>제품당</span>
            <strong>{formatWon(Math.round(electricityPerProduct))}</strong>
          </p>
        </section>

        <section className="operating-cost-group" aria-labelledby="water-cost-title">
          <header><Icon name="droplet" size={18} /><h2 id="water-cost-title">물세</h2></header>
          <div className="operating-cost-group__fields">
            <CostInput field="water" label="수도요금 (₩)" value={costs.water} icon="droplet" suffix="원" onChange={onCostChange} />
          </div>
          <p className="operating-cost-group__per-product">
            <span>제품당</span>
            <strong>{formatWon(Math.round(waterPerProduct))}</strong>
          </p>
        </section>

        {costs.customItems.map((item) => {
          const perProduct = toWonNumber(item.amount) / productCount
          return (
            <section className="operating-cost-group operating-cost-group--custom" key={item.id}>
              <header>
                <Icon name="landmark" size={18} />
                <input
                  className="operating-cost-group__name-input"
                  type="text"
                  value={item.name}
                  placeholder="항목 이름"
                  onChange={(event) => onUpdateCustomItem(item.id, { name: event.target.value })}
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
              <div className="operating-cost-group__fields">
                <label className="operating-cost-field">
                  <span>금액 (₩)</span>
                  <span className="operating-cost-input">
                    <input
                      min="0"
                      type="number"
                      value={item.amount}
                      onChange={(event) => onUpdateCustomItem(item.id, { amount: event.target.value })}
                    />
                    <small>원</small>
                  </span>
                </label>
              </div>
              <p className="operating-cost-group__per-product">
                <span>제품당</span>
                <strong>{formatWon(Math.round(perProduct))}</strong>
              </p>
            </section>
          )
        })}
      </div>

      <button type="button" className="operating-cost-add" onClick={onAddCustomItem}>
        <Icon name="add" size={16} /> 항목 추가
      </button>

      <section className="operating-cost-summary" aria-label="운영비 합계">
        <div><span>인건비</span><strong>{formatWon(totals.laborCost)}</strong></div>
        <div><span>공과금</span><strong>{formatWon(totals.utilityCost)}</strong></div>
        <div className="operating-cost-summary__total"><span>총 운영비</span><strong>{formatWon(totals.totalCost)}</strong></div>
      </section>
    </>
  )
}
