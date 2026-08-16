import { useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { fetchExchangeRates } from '../../lib/api/exchangeRates'

type CurrencyCode = string

type CurrencySetting = {
  flag: string
  label: string
  rate: number
  symbol: string
  fractionDigits: number
}

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
const CURRENCY_STORAGE_KEY = 'sunshine.exchange-calculator-currencies.v1'

const defaultCurrencies: Record<CurrencyCode, CurrencySetting> = {
  USD: { flag: '🇺🇸', label: '미국 달러', rate: 1_342.5, symbol: '$', fractionDigits: 2 },
  JPY: { flag: '🇯🇵', label: '일본 엔', rate: 9.048, symbol: '¥', fractionDigits: 0 },
  EUR: { flag: '🇪🇺', label: '유로', rate: 1_455, symbol: '€', fractionDigits: 2 },
  CNY: { flag: '🇨🇳', label: '중국 위안', rate: 185.4, symbol: '¥', fractionDigits: 2 },
  SAR: { flag: '🇸🇦', label: '사우디 리얄', rate: 357.8, symbol: 'SAR', fractionDigits: 2 },
  AED: { flag: '🇦🇪', label: 'UAE 디르함', rate: 365.4, symbol: 'AED', fractionDigits: 2 },
}

const loadCurrencies = (): Record<CurrencyCode, CurrencySetting> => {
  let saved: Record<string, Partial<CurrencySetting>> = {}
  try {
    saved = JSON.parse(window.localStorage.getItem(CURRENCY_STORAGE_KEY) ?? '{}') as typeof saved
  } catch {
    saved = {}
  }

  const merged: Record<CurrencyCode, CurrencySetting> = { ...defaultCurrencies }
  Object.entries(saved).forEach(([code, value]) => {
    const base = merged[code]
    merged[code] = {
      flag: value.flag ?? base?.flag ?? '🏳️',
      label: value.label ?? base?.label ?? code,
      rate: value.rate ?? base?.rate ?? 0,
      symbol: value.symbol ?? base?.symbol ?? code,
      fractionDigits: value.fractionDigits ?? base?.fractionDigits ?? 2,
    }
  })
  return merged
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

type SavedRow = { name?: string; cost?: number; marginRate?: number }

const loadProductRows = (products: RecipeProduct[]): ExchangeMaterialRow[] => {
  let saved: Record<string, SavedRow> = {}
  try {
    saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as typeof saved
  } catch {
    saved = {}
  }

  const productRows = products.map((product, index) => ({
    id: product.id,
    name: saved[product.id]?.name ?? product.name,
    cost: saved[product.id]?.cost ?? productTotalCost(product),
    marginRate: saved[product.id]?.marginRate ?? defaultMargins[index % defaultMargins.length],
  }))

  const productIds = new Set(products.map((product) => product.id))
  const extraRows = Object.entries(saved)
    .filter(([id]) => !productIds.has(id))
    .map(([id, value]) => ({
      id,
      name: value.name ?? '새 제품',
      cost: value.cost ?? 0,
      marginRate: value.marginRate ?? 20,
    }))

  return [...productRows, ...extraRows]
}

const formatKrw = (value: number) => Math.round(value).toLocaleString('ko-KR')

const formatRateTime = (date: Date) => date.toLocaleString('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const calculateCost = (row: ExchangeMaterialRow) => row.cost
const calculateSalePrice = (row: ExchangeMaterialRow) => calculateCost(row) * (1 + row.marginRate / 100)
const calculateLocalPrice = (row: ExchangeMaterialRow, setting: CurrencySetting) => (
  setting.rate > 0 ? calculateSalePrice(row) / setting.rate : 0
)

const formatLocalPrice = (row: ExchangeMaterialRow, setting: CurrencySetting) => (
  `${setting.symbol} ${calculateLocalPrice(row, setting).toLocaleString('en-US', {
    minimumFractionDigits: setting.fractionDigits,
    maximumFractionDigits: setting.fractionDigits,
  })}`
)

export function ExchangeRateCalculatorPage({
  products = [],
  onNavigate,
  onAction,
}: ExchangeRateCalculatorPageProps) {
  const [rows, setRows] = useState<ExchangeMaterialRow[]>(() => loadProductRows(products))
  const [currencies, setCurrencies] = useState<Record<CurrencyCode, CurrencySetting>>(() => loadCurrencies())
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD')
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>('')
  const [isRateLoading, setIsRateLoading] = useState(true)
  const [isAddingCurrency, setIsAddingCurrency] = useState(false)
  const [newCurrency, setNewCurrency] = useState({ code: '', label: '', rate: '' })

  const currencyCodes = Object.keys(currencies)
  const selectedSetting = currencies[selectedCurrency] ?? currencies[currencyCodes[0]]

  const changeCurrency = (code: CurrencyCode) => {
    setSelectedCurrency(code)
  }

  // 실시간 환율을 받아 각 통화 rate 를 덮어쓴다. 실패하면 하드코딩 폴백을 유지한다.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { rates, updatedAt } = await fetchExchangeRates()
      if (cancelled) return
      setIsRateLoading(false)
      if (Object.keys(rates).length === 0) return // API 실패 → 폴백 유지
      setCurrencies((current) => {
        const next: Record<CurrencyCode, CurrencySetting> = {}
        for (const [code, setting] of Object.entries(current)) {
          next[code] = rates[code] ? { ...setting, rate: rates[code] } : setting
        }
        return next
      })
      setRateUpdatedAt(formatRateTime(updatedAt ? new Date(updatedAt) : new Date()))
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const settings = Object.fromEntries(
      rows.map((row) => [row.id, { name: row.name, cost: row.cost, marginRate: row.marginRate }]),
    )
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [rows])

  useEffect(() => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currencies))
  }, [currencies])

  const addCurrency = () => {
    const code = newCurrency.code.trim().toUpperCase()
    const label = newCurrency.label.trim()
    const rate = parseNumber(newCurrency.rate)

    if (!code || !label || rate <= 0) {
      onAction('통화 코드, 이름, 환율(0보다 큰 값)을 모두 입력해 주세요.')
      return
    }
    if (currencies[code]) {
      onAction(`이미 등록된 통화 코드입니다: ${code}`)
      return
    }

    setCurrencies((current) => ({
      ...current,
      [code]: { flag: '🏳️', label, rate, symbol: code, fractionDigits: 2 },
    }))
    setNewCurrency({ code: '', label: '', rate: '' })
    setIsAddingCurrency(false)
    changeCurrency(code)
    onAction(`${code} · ${label} 통화를 추가했습니다.`)
  }

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
              <div className="exchange-currency-picker__control">
                <select
                  value={selectedCurrency}
                  onChange={(event) => changeCurrency(event.target.value)}
                >
                  {currencyCodes.map((code) => (
                    <option key={code} value={code}>
                      {currencies[code].flag} {code} · {currencies[code].label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="exchange-currency-picker__add"
                  aria-label="통화 추가"
                  aria-expanded={isAddingCurrency}
                  onClick={() => setIsAddingCurrency((open) => !open)}
                >
                  <Icon name="add" size={16} />
                </button>
              </div>
            </label>
            <small className="exchange-currency-picker__time">
              {isRateLoading
                ? '실시간 환율 불러오는 중…'
                : rateUpdatedAt
                  ? `${rateUpdatedAt} 실시간 환율`
                  : '실시간 환율 연결 실패 · 기준값 사용'}
            </small>
          </div>
        </header>

        {isAddingCurrency && (
          <section className="exchange-currency-form" aria-label="새 통화 추가">
            <div className="exchange-currency-form__fields">
              <label>
                <span>통화 코드</span>
                <input
                  type="text"
                  value={newCurrency.code}
                  placeholder="예: THB"
                  maxLength={5}
                  onChange={(event) => setNewCurrency((prev) => ({ ...prev, code: event.target.value }))}
                />
              </label>
              <label>
                <span>통화 이름</span>
                <input
                  type="text"
                  value={newCurrency.label}
                  placeholder="예: 태국 바트"
                  onChange={(event) => setNewCurrency((prev) => ({ ...prev, label: event.target.value }))}
                />
              </label>
              <label>
                <span>환율 (1단위 = ? 원)</span>
                <NumberInput
                  min="0"
                  value={newCurrency.rate}
                  placeholder="예: 40.5"
                  onValueChange={(raw) => setNewCurrency((prev) => ({ ...prev, rate: raw }))}
                />
              </label>
            </div>
            <div className="exchange-currency-form__actions">
              <button type="button" className="exchange-currency-form__cancel" onClick={() => setIsAddingCurrency(false)}>
                취소
              </button>
              <button type="button" className="exchange-currency-form__submit" onClick={addCurrency}>
                <Icon name="add" size={16} /> 추가
              </button>
            </div>
          </section>
        )}

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
                      <input
                        className="exchange-name-input"
                        type="text"
                        aria-label="제품명"
                        value={row.name}
                        placeholder="제품명"
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      />
                      <span>제품 1개 기준</span>
                    </td>
                    <td data-label="계산 원가">
                      <label className="exchange-cost-field">
                        <span className="visually-hidden">{row.name} 계산 원가</span>
                        <NumberInput
                          min="0"
                          value={row.cost}
                          onValueChange={(raw) => updateRow(row.id, { cost: Math.max(0, parseNumber(raw)) })}
                        />
                      </label>
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
                      <strong className="exchange-local-price">{formatLocalPrice(row, selectedSetting)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
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
