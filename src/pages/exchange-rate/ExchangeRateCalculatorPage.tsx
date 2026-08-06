import { useMemo, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'

type CurrencyCode = 'USD' | 'JPY' | 'EUR' | 'CNY'

type ExchangeMaterialRow = {
  id: string
  name: string
  cost: number
  marginRate: number
}

type ExchangeRateCalculatorPageProps = {
  products?: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const SETTINGS_STORAGE_KEY = 'sunshine.exchange-calculator-settings.v1'

const currencySettings: Record<CurrencyCode, {
  flag: string
  label: string
  rate: number
  symbol: string
  fractionDigits: number
}> = {
  USD: { flag: '🇺🇸', label: '미국 달러', rate: 1_342.5, symbol: '$', fractionDigits: 2 },
  JPY: { flag: '🇯🇵', label: '일본 엔', rate: 9.048, symbol: '¥', fractionDigits: 0 },
  EUR: { flag: '🇪🇺', label: '유로', rate: 1_455, symbol: '€', fractionDigits: 2 },
  CNY: { flag: '🇨🇳', label: '중국 위안', rate: 185.4, symbol: '¥', fractionDigits: 2 },
}

const defaultMargins = [20, 15, 25]

const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[,\s₩원]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const productTotalCost = (product: RecipeProduct) => {
  const indirect = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  return product.materialCost + product.laborCost + indirect
}

const loadProductRows = (products: RecipeProduct[]): ExchangeMaterialRow[] => {
  let savedSettings: Record<string, { marginRate?: number }> = {}
  try {
    savedSettings = JSON.parse(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}',
    ) as typeof savedSettings
  } catch {
    savedSettings = {}
  }

  return products.map((product, index) => ({
    id: product.id,
    name: product.name,
    cost: productTotalCost(product),
    marginRate: savedSettings[product.id]?.marginRate ?? defaultMargins[index % defaultMargins.length],
  }))
}

const formatKrw = (value: number) => Math.round(value).toLocaleString('ko-KR')

const formatRateTime = (date: Date) => date.toLocaleTimeString('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
})

const calculateCost = (row: ExchangeMaterialRow) => row.cost
const calculateSalePrice = (row: ExchangeMaterialRow) => calculateCost(row) * (1 + row.marginRate / 100)
const calculateLocalPrice = (row: ExchangeMaterialRow, currency: CurrencyCode) => (
  calculateSalePrice(row) / currencySettings[currency].rate
)

const formatLocalPrice = (row: ExchangeMaterialRow, currency: CurrencyCode) => {
  const setting = currencySettings[currency]
  return `${setting.symbol} ${calculateLocalPrice(row, currency).toLocaleString('en-US', {
    minimumFractionDigits: setting.fractionDigits,
    maximumFractionDigits: setting.fractionDigits,
  })}`
}

export function ExchangeRateCalculatorPage({
  products = [],
  onNavigate,
}: ExchangeRateCalculatorPageProps) {
  const [rows, setRows] = useState<ExchangeMaterialRow[]>(() => loadProductRows(products))
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD')
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>(() => formatRateTime(new Date()))

  const changeCurrency = (code: CurrencyCode) => {
    setSelectedCurrency(code)
    setRateUpdatedAt(formatRateTime(new Date()))
  }

  const totalSalePrice = useMemo(
    () => rows.reduce((total, row) => total + calculateSalePrice(row), 0),
    [rows],
  )

  const totalCost = useMemo(
    () => rows.reduce((total, row) => total + calculateCost(row), 0),
    [rows],
  )

  const averageMarginRate = useMemo(
    () => rows.length > 0
      ? rows.reduce((total, row) => total + row.marginRate, 0) / rows.length
      : 0,
    [rows],
  )

  const updateRow = (id: string, values: Partial<ExchangeMaterialRow>) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, ...values } : row
    )))
  }

  const addMaterial = () => {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: `새 제품 ${current.length + 1}`,
        cost: 0,
        marginRate: 20,
      },
    ])
  }

  return (
    <div className="dashboard-app exchange-calculator-layout">
      <Sidebar activeRoute="exchange-rate-detail" onNavigate={onNavigate} />

      <main className="exchange-calculator-page">
        <header className="exchange-calculator-header">
          <div>
            <h1>제품별 환율 산출</h1>
            <p>등록된 제품의 원가를 기준으로 마진과 고정 환율을 적용해 현지 판매가를 계산합니다.</p>
          </div>
          <div className="exchange-currency-picker">
            <label>
              <span>대상 통화</span>
              <select
                value={selectedCurrency}
                onChange={(event) => changeCurrency(event.target.value as CurrencyCode)}
              >
                {(Object.keys(currencySettings) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>
                    {currencySettings[code].flag} {code} · {currencySettings[code].label}
                  </option>
                ))}
              </select>
            </label>
            <small className="exchange-currency-picker__time">{rateUpdatedAt} 기준 환율</small>
          </div>
        </header>

        <section className="exchange-table-card" aria-labelledby="exchange-table-title">
          <h2 className="visually-hidden" id="exchange-table-title">제품별 환율 산출표</h2>
          <div className="exchange-table-scroll">
            <table className="exchange-table">
              <thead>
                <tr>
                  <th scope="col">제품명</th>
                  <th scope="col">계산 원가<br />(KRW)</th>
                  <th scope="col">마진율 (%)</th>
                  <th scope="col">판매가 (KRW)</th>
                  <th scope="col">현지 판매가</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="제품명">
                      <strong>{row.name}</strong>
                      <span>제품 1개 기준</span>
                    </td>
                    <td data-label="계산 원가">
                      <span className="exchange-number">{formatKrw(calculateCost(row))}</span>
                    </td>
                    <td data-label="마진율">
                      <label className="exchange-margin-field">
                        <span className="visually-hidden">{row.name} 마진율</span>
                        <input
                          min="0"
                          max="999"
                          step="0.1"
                          type="number"
                          value={row.marginRate}
                          onChange={(event) => updateRow(row.id, {
                            marginRate: Math.max(0, parseNumber(event.target.value)),
                          })}
                        />
                        <em>%</em>
                      </label>
                    </td>
                    <td data-label="판매가">
                      <strong className="exchange-sale-price">{formatKrw(calculateSalePrice(row))}</strong>
                    </td>
                    <td data-label="현지 판매가">
                      <strong className="exchange-local-price">{formatLocalPrice(row, selectedCurrency)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">총 합계</th>
                  <td>
                    <strong>{formatKrw(totalCost)}</strong>
                    <span>KRW</span>
                  </td>
                  <td>
                    <strong>{averageMarginRate.toFixed(1)}%</strong>
                    <span>평균 마진율</span>
                  </td>
                  <td>
                    <strong>{formatKrw(totalSalePrice)}</strong>
                    <span>KRW</span>
                  </td>
                  <td>
                    <strong>{currencySettings[selectedCurrency].symbol} {(totalSalePrice / currencySettings[selectedCurrency].rate).toLocaleString('en-US', { minimumFractionDigits: currencySettings[selectedCurrency].fractionDigits, maximumFractionDigits: currencySettings[selectedCurrency].fractionDigits })}</strong>
                    <span>{selectedCurrency} 합계</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button className="exchange-add-material" type="button" onClick={addMaterial}>
            <Icon name="add" size={18} /> 새 제품 추가
          </button>
        </section>
      </main>
    </div>
  )
}
