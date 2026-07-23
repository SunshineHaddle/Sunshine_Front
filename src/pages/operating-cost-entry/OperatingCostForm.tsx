import { Icon, type IconName } from '../../components/common/Icon'
import {
  formatWon,
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
  costs: OperatingCosts
  fileName: string
  totals: CostTotals
  onCostChange: (field: CostField, value: string) => void
  onFileChange: (file: File) => void
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

export function OperatingCostForm({ costs, fileName, totals, onCostChange, onFileChange }: OperatingCostFormProps) {
  return (
    <>
      <label className="operating-excel-upload">
        <span className="operating-excel-upload__icon"><Icon name="upload" size={25} /></span>
        <strong>Excel을 통한 비용 가져오기</strong>
        <small>{fileName || '.xlsx 파일을 드래그 앤 드롭하거나 클릭하여 찾아보기'}</small>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFileChange(file)
          }}
        />
      </label>

      <div className="operating-cost-groups">
        <section className="operating-cost-group" aria-labelledby="labor-cost-title">
          <header><Icon name="users" size={18} /><h2 id="labor-cost-title">인건비</h2></header>
          <div className="operating-cost-group__fields">
            <CostInput field="productionHours" label="총 생산 시간" value={costs.productionHours} suffix="시간" onChange={onCostChange} />
            <CostInput field="hourlyWage" label="평균 시급 (₩)" value={costs.hourlyWage} suffix="원" onChange={onCostChange} />
          </div>
          <p className="operating-cost-group__subtotal">예상 인건비 <strong>{formatWon(totals.laborCost)}</strong></p>
        </section>

        <section className="operating-cost-group" aria-labelledby="utility-cost-title">
          <header><Icon name="bolt" size={18} /><h2 id="utility-cost-title">공과금</h2></header>
          <div className="operating-cost-group__fields">
            <CostInput field="electricity" label="전기요금 (₩)" value={costs.electricity} icon="bolt" suffix="원" onChange={onCostChange} />
            <CostInput field="water" label="수도요금 (₩)" value={costs.water} icon="droplet" suffix="원" onChange={onCostChange} />
          </div>
          <p className="operating-cost-group__subtotal">공과금 합계 <strong>{formatWon(totals.utilityCost)}</strong></p>
        </section>

        <section className="operating-cost-group operating-cost-group--wide" aria-labelledby="indirect-cost-title">
          <header><Icon name="landmark" size={18} /><h2 id="indirect-cost-title">재무 간접비</h2></header>
          <div className="operating-cost-group__fields operating-cost-group__fields--two-column">
            <CostInput field="fixedCosts" label="고정 임대료·시설 비용" value={costs.fixedCosts} suffix="원" onChange={onCostChange} />
            <CostInput field="wasteTransport" label="폐기물 및 운송" value={costs.wasteTransport} suffix="원" onChange={onCostChange} />
          </div>
          <p className="operating-cost-group__subtotal">간접비 합계 <strong>{formatWon(totals.indirectCost)}</strong></p>
        </section>
      </div>

      <section className="operating-cost-summary" aria-label="운영비 합계">
        <div><span>인건비</span><strong>{formatWon(totals.laborCost)}</strong></div>
        <div><span>공과금</span><strong>{formatWon(totals.utilityCost)}</strong></div>
        <div><span>재무 간접비</span><strong>{formatWon(totals.indirectCost)}</strong></div>
        <div className="operating-cost-summary__total"><span>총 운영비</span><strong>{formatWon(totals.totalCost)}</strong></div>
      </section>
    </>
  )
}
