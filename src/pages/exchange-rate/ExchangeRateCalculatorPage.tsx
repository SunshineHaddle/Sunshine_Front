import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { fetchExchangeRates } from '../../lib/api/exchangeRates'
import { fetchPeriodByMonth } from '../../lib/api/periods'
import { fetchCostSummaries } from '../../lib/api/results'
import { FlagIcon } from '../../components/common/FlagIcon'

type CurrencyCode = string

type CurrencySetting = {
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
  quantityKg: number
}

type ExchangeRateCalculatorPageProps = {
  products?: RecipeProduct[]
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const SETTINGS_STORAGE_KEY = 'sunshine.exchange-calculator-settings.v1'
const CURRENCY_STORAGE_KEY = 'sunshine.exchange-calculator-currencies.v1'

const defaultCurrencies: Record<CurrencyCode, CurrencySetting> = {
  USD: { label: '미국 달러', rate: 1_342.5, symbol: '$', fractionDigits: 2 },
  JPY: { label: '일본 엔', rate: 9.048, symbol: '¥', fractionDigits: 0 },
  EUR: { label: '유로', rate: 1_455, symbol: '€', fractionDigits: 2 },
  CNY: { label: '중국 위안', rate: 185.4, symbol: '¥', fractionDigits: 2 },
  SAR: { label: '사우디 리얄', rate: 357.8, symbol: 'SAR', fractionDigits: 2 },
  AED: { label: 'UAE 디르함', rate: 365.4, symbol: 'AED', fractionDigits: 2 },
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

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

type SavedRow = { marginRate?: number; quantityKg?: number }

/**
 * 사용자가 표에서 직접 고친 값만 저장한다.
 * 행 자체는 제품 관리 목록에서 파생되므로 여기에 담지 않는다 —
 * 담아두면 제품이 비동기로 도착할 때 표가 빈 채로 굳는다.
 */
const loadOverrides = (): Record<string, SavedRow> => {
  try {
    return JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, SavedRow>
  } catch {
    return {}
  }
}

const formatKrw = (value: number) => Math.round(value).toLocaleString('ko-KR')

const formatRateTime = (date: Date) => date.toLocaleString('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const calculateUnitSalePrice = (row: ExchangeMaterialRow) => row.cost * (1 + row.marginRate / 100)
const calculateSalePrice = (row: ExchangeMaterialRow) => calculateUnitSalePrice(row) * row.quantityKg
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
  const [overrides, setOverrides] = useState<Record<string, SavedRow>>(loadOverrides)
  /**
   * 그 달 제품별 경영 총원가 — 대시보드 수익성 표의 그 열과 같은 값이다.
   * total_cost 가 아니라 unit_cost(포장 1개당 총원가)를 쓴다.
   * 판매가·수량과 같은 단위여야 나란히 곱할 수 있다.
   */
  const [monthlyCostById, setMonthlyCostById] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const period = await fetchPeriodByMonth(currentMonth())
        if (cancelled || !period) return
        const summaries = await fetchCostSummaries(period.id)
        if (cancelled) return
        setMonthlyCostById(Object.fromEntries(
          // 소수점은 표시하지 않으므로 여기서 정수로 굳힌다
          summaries.map((s) => [s.productId, Math.round(s.unitCost)]),
        ))
      } catch {
        if (!cancelled) setMonthlyCostById({})
      }
    })()
    return () => { cancelled = true }
  }, [])

  /**
   * 표의 행 = 제품 관리에 등록된 제품 전부, 그리고 그것뿐.
   * 제품 목록이 비동기로 도착해도 여기서 다시 계산되므로 동기화가 필요 없다.
   */
  const rows = useMemo<ExchangeMaterialRow[]>(
    () => products.map((product, index) => ({
      id: product.id,
      name: product.name,
      // 계산 원가는 그 달 확정 경영 총원가(포장 1개당)를 그대로 쓴다 (직접 고치지 않는다)
      cost: monthlyCostById[product.id] ?? 0,
      marginRate: overrides[product.id]?.marginRate
        ?? defaultMargins[index % defaultMargins.length],
      quantityKg: overrides[product.id]?.quantityKg ?? 1,
    })),
    [products, overrides, monthlyCostById],
  )
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

  // 사용자가 고친 값만 남긴다. 안 고친 제품은 제품 관리 값을 계속 따라간다.
  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(overrides))
  }, [overrides])

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
      [code]: { label, rate, symbol: code, fractionDigits: 2 },
    }))
    setNewCurrency({ code: '', label: '', rate: '' })
    setIsAddingCurrency(false)
    changeCurrency(code)
    onAction(`${code} · ${label} 통화를 추가했습니다.`)
  }

  const updateRow = (id: string, values: Partial<ExchangeMaterialRow>) => {
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...(values.marginRate !== undefined && { marginRate: values.marginRate }),
        ...(values.quantityKg !== undefined && { quantityKg: values.quantityKg }),
      },
    }))
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
                {/* option 안에는 마크업이 못 들어가므로 선택된 통화의 국기만 옆에 둔다.
                    이모지는 Windows 에서 국기로 그려지지 않아 쓰지 않는다 */}
                <FlagIcon code={selectedCurrency} size={20} className="exchange-currency-picker__flag" />
                <select
                  value={selectedCurrency}
                  onChange={(event) => changeCurrency(event.target.value)}
                >
                  {currencyCodes.map((code) => (
                    <option key={code} value={code}>
                      {code} · {currencies[code].label}
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
                  <th scope="col">마진율 (%)<em className="exchange-th__editable">직접 입력</em></th>
                  <th scope="col">판매가 (KRW)</th>
                  <th scope="col">제품 수량<em className="exchange-th__editable">직접 입력</em></th>
                  <th scope="col">현지 판매가</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="exchange-table__empty" colSpan={6}>
                      제품 관리에 등록된 제품이 없습니다. 제품을 먼저 등록해주세요.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="제품명">
                      <strong className="exchange-name">{row.name}</strong>
                      <span>제품 1개 기준</span>
                    </td>
                    <td data-label="계산 원가">
                      {/* 그 달 확정 총원가라 화면에서 고치지 않는다 */}
                      <strong className="exchange-number">{formatKrw(row.cost)}</strong>
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
                    <td data-label="수량">
                      <label className="exchange-quantity-field">
                        <span className="visually-hidden">{row.name} 제품 수량</span>
                        <NumberInput
                          min="0"
                          value={row.quantityKg}
                          onValueChange={(raw) => updateRow(row.id, { quantityKg: Math.max(0, parseNumber(raw)) })}
                        />
                      </label>
                    </td>
                    <td data-label="현지 판매가">
                      <strong className="exchange-local-price">{formatLocalPrice(row, selectedSetting)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
