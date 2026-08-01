import { useMemo, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import type { MaterialRow } from '../../utils/materials'

type CurrencyCode = 'USD' | 'JPY' | 'EUR' | 'CNY'

type ExchangeMaterialRow = {
  id: string
  name: string
  quantity: number
  unitCost: number
  marginRate: number
  currency: CurrencyCode
}

type ExchangeRateCalculatorPageProps = {
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

const fallbackMaterials: Omit<ExchangeMaterialRow, 'marginRate' | 'currency'>[] = [
  { id: 'exchange-fallback-1', name: '배추', quantity: 10, unitCost: 2_500 },
  { id: 'exchange-fallback-2', name: '고춧가루', quantity: 5, unitCost: 17_000 },
  { id: 'exchange-fallback-3', name: '다진 마늘', quantity: 2, unitCost: 16_000 },
]

const additionalMaterials = [
  { name: '천일염', quantity: 3, unitCost: 1_200 },
  { name: '대파', quantity: 2, unitCost: 4_300 },
  { name: '생강', quantity: 1, unitCost: 9_500 },
]

const defaultMargins = [20, 15, 25]
const defaultCurrencies: CurrencyCode[] = ['USD', 'JPY', 'EUR']

const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[,\s₩원]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const loadMaterialRows = (): ExchangeMaterialRow[] => {
  let materials = fallbackMaterials

  try {
    const stored = JSON.parse(
      window.localStorage.getItem('cost-analysis-material-preview') ?? '[]',
    ) as MaterialRow[]
    const parsed = stored
      .filter((row) => row.name.trim())
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        quantity: parseNumber(row.quantity),
        unitCost: parseNumber(row.unitCost),
      }))

    if (parsed.length > 0) materials = parsed
  } catch {
    materials = fallbackMaterials
  }

  let savedSettings: Record<string, { marginRate?: number; currency?: CurrencyCode }> = {}
  try {
    savedSettings = JSON.parse(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}',
    ) as typeof savedSettings
  } catch {
    savedSettings = {}
  }

  return materials.map((material, index) => ({
    ...material,
    marginRate: savedSettings[material.id]?.marginRate ?? defaultMargins[index % defaultMargins.length],
    currency: savedSettings[material.id]?.currency ?? defaultCurrencies[index % defaultCurrencies.length],
  }))
}

const formatKrw = (value: number) => Math.round(value).toLocaleString('ko-KR')

const formatQuantity = (value: number) => value.toLocaleString('ko-KR', {
  maximumFractionDigits: 4,
})

const calculateCost = (row: ExchangeMaterialRow) => row.quantity * row.unitCost
const calculateSalePrice = (row: ExchangeMaterialRow) => calculateCost(row) * (1 + row.marginRate / 100)
const calculateLocalPrice = (row: ExchangeMaterialRow) => (
  calculateSalePrice(row) / currencySettings[row.currency].rate
)

const formatLocalPrice = (row: ExchangeMaterialRow) => {
  const setting = currencySettings[row.currency]
  return `${setting.symbol} ${calculateLocalPrice(row).toLocaleString('en-US', {
    minimumFractionDigits: setting.fractionDigits,
    maximumFractionDigits: setting.fractionDigits,
  })}`
}

export function ExchangeRateCalculatorPage({
  onNavigate,
  onAction,
}: ExchangeRateCalculatorPageProps) {
  const [rows, setRows] = useState<ExchangeMaterialRow[]>(loadMaterialRows)

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

  const currencyCount = useMemo(
    () => new Set(rows.map((row) => row.currency)).size,
    [rows],
  )

  const updateRow = (id: string, values: Partial<ExchangeMaterialRow>) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, ...values } : row
    )))
  }

  const addMaterial = () => {
    const next = additionalMaterials.find((material) => (
      !rows.some((row) => row.name === material.name)
    ))
    const material = next ?? {
      name: `추가 원재료 ${rows.length + 1}`,
      quantity: 1,
      unitCost: 0,
    }

    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        ...material,
        marginRate: 20,
        currency: 'USD',
      },
    ])
  }

  const saveSettings = () => {
    const settings = Object.fromEntries(rows.map((row) => [
      row.id,
      { marginRate: row.marginRate, currency: row.currency },
    ]))
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    onAction('환율 산출 설정을 브라우저에 저장했습니다.')
  }

  const downloadCsv = () => {
    const header = ['품목명', '수량(kg)', '계산 원가(KRW)', '마진율(%)', '판매가(KRW)', '통화', '현지 판매가']
    const values = rows.map((row) => [
      row.name,
      row.quantity,
      Math.round(calculateCost(row)),
      row.marginRate,
      Math.round(calculateSalePrice(row)),
      row.currency,
      Number(calculateLocalPrice(row).toFixed(currencySettings[row.currency].fractionDigits)),
    ])
    const csv = [header, ...values]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    }))
    const link = document.createElement('a')
    link.href = url
    link.download = '원재료_환율_산출.csv'
    link.click()
    URL.revokeObjectURL(url)
    onAction('원재료 환율 산출표를 다운로드했습니다.')
  }

  return (
    <div className="dashboard-app exchange-calculator-layout">
      <Sidebar activeRoute="exchange-rate-detail" onNavigate={onNavigate} />

      <main className="exchange-calculator-page">
        <header className="exchange-calculator-header">
          <div>
            <h1>품목별 환율 산출</h1>
            <p>데이터 입력 1단계의 원재료를 기준으로 마진과 고정 환율을 적용해 현지 판매가를 계산합니다.</p>
          </div>
          <div className="exchange-calculator-header__actions">
            <button className="exchange-action exchange-action--secondary" type="button" onClick={downloadCsv}>
              <Icon name="download" size={17} /> 엑셀 다운로드
            </button>
            <button className="exchange-action exchange-action--primary" type="button" onClick={saveSettings}>
              <Icon name="check" size={17} /> 변경사항 저장
            </button>
          </div>
        </header>

        <section className="exchange-table-card" aria-labelledby="exchange-table-title">
          <h2 className="visually-hidden" id="exchange-table-title">원재료별 환율 산출표</h2>
          <div className="exchange-table-scroll">
            <table className="exchange-table">
              <thead>
                <tr>
                  <th scope="col">품목명</th>
                  <th scope="col">계산 원가<br />(KRW)</th>
                  <th scope="col">마진율 (%)</th>
                  <th scope="col">판매가 (KRW)</th>
                  <th scope="col">대상 통화</th>
                  <th scope="col">현지 판매가</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="품목명">
                      <strong>{row.name}</strong>
                      <span>{formatQuantity(row.quantity)}kg 기준</span>
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
                    <td data-label="대상 통화">
                      <label className="exchange-currency-field">
                        <span className="visually-hidden">{row.name} 대상 통화</span>
                        <select
                          value={row.currency}
                          onChange={(event) => updateRow(row.id, {
                            currency: event.target.value as CurrencyCode,
                          })}
                        >
                          {(Object.keys(currencySettings) as CurrencyCode[]).map((code) => (
                            <option key={code} value={code}>
                              {currencySettings[code].flag} {code} · {currencySettings[code].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td data-label="현지 판매가">
                      <strong className="exchange-local-price">{formatLocalPrice(row)}</strong>
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
                    <strong>{currencyCount}개</strong>
                    <span>사용 통화</span>
                  </td>
                  <td>
                    <strong>—</strong>
                    <span>통화별 합산 불가</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button className="exchange-add-material" type="button" onClick={addMaterial}>
            <Icon name="add" size={18} /> 새 원재료 추가
          </button>
        </section>

        <section className="exchange-status-grid" aria-label="환율 산출 기준 정보">
          <article>
            <span>고정 USD 기준 환율</span>
            <strong>1,342.50 <small>KRW</small></strong>
            <em>프론트 목업</em>
          </article>
          <article>
            <span>데이터 기준</span>
            <strong>데이터 입력 1단계 원재료</strong>
            <small>브라우저 임시 저장값 우선</small>
          </article>
        </section>
      </main>
    </div>
  )
}
