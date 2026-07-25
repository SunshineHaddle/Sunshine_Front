import { Icon } from '../common/Icon'

type Currency = {
  code: string
  label: string
  value: string
}

const currencies: Currency[] = []

type ExchangeRateCardProps = {
  onOpen: () => void
}

export function ExchangeRateCard({ onOpen }: ExchangeRateCardProps) {
  return (
    <button
      className="card exchange-card exchange-card--link"
      type="button"
      aria-labelledby="exchange-card-title"
      onClick={onOpen}
    >
      <div className="exchange-card__heading">
        <h2 id="exchange-card-title">
          <Icon name="exchange" size={23} />
          <span>실시간 환율</span>
        </h2>
        <span className="live-badge">데이터 없음</span>
      </div>

      <div className="exchange-card__primary">
        <div className="exchange-card__value">
          <strong>--</strong>
          <span className="exchange-card__unit">KRW/USD</span>
        </div>
        <p>변동 정보가 없습니다.</p>
      </div>

      <div className="currency-list">
        {currencies.length === 0 && <p className="currency-empty">표시할 환율 데이터가 없습니다.</p>}
        {currencies.map((currency) => (
          <div className="currency-row" key={currency.label}>
            <span className="currency-code">{currency.code}</span>
            <span>{currency.label}</span>
            <strong>{currency.value}</strong>
          </div>
        ))}
      </div>
      <span className="exchange-card__open">환율 산출 열기 <Icon name="chevron-right" size={14} /></span>
    </button>
  )
}
