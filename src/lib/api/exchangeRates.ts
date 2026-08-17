/**
 * 실시간 환율. open.er-api.com (무료·키 불요·CORS 허용, ECB/시장 데이터).
 * 응답은 "1 KRW = rates[code]" 형태라, 앱이 쓰는 "1 외화 = ? 원" 으로 뒤집는다.
 * 하루 한 번 갱신되므로 localStorage 에 캐싱하고 6시간 TTL 을 둔다.
 * 네트워크·API 실패 시 호출부의 하드코딩 폴백을 그대로 쓰게 null 을 던지지 않고 빈 값으로 흘린다.
 */

const ENDPOINT = 'https://open.er-api.com/v6/latest/KRW'
const CACHE_KEY = 'sunshine.exchange-rates.v1'
const TTL_MS = 6 * 60 * 60 * 1000 // 6시간

/** code → 1 외화 단위당 원화 (예: USD → 1342.5) */
export type RateMap = Record<string, number>

export type ExchangeRatesResult = {
  rates: RateMap
  /** API 가 표기한 최종 갱신 시각 (ms). 실패 시 0 */
  updatedAt: number
}

type CacheShape = { fetchedAt: number; result: ExchangeRatesResult }

type ApiResponse = {
  result?: string
  time_last_update_unix?: number
  rates?: Record<string, number>
}

function readCache(): ExchangeRatesResult | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as CacheShape
    if (Date.now() - cache.fetchedAt > TTL_MS) return null
    return cache.result
  } catch {
    return null
  }
}

function writeCache(result: ExchangeRatesResult) {
  try {
    const cache: CacheShape = { fetchedAt: Date.now(), result }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // 저장 실패는 무시 — 이번 세션에서만 못 쓸 뿐이다
  }
}

/**
 * 실시간 환율을 가져온다. 캐시가 신선하면 네트워크를 타지 않는다.
 * 실패하면 rates 는 빈 객체, updatedAt 은 0. (호출부가 폴백을 유지)
 * @param force true 면 캐시를 무시하고 새로 받는다
 */
export async function fetchExchangeRates(force = false): Promise<ExchangeRatesResult> {
  if (!force) {
    const cached = readCache()
    if (cached) return cached
  }

  try {
    const response = await fetch(ENDPOINT)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as ApiResponse
    if (data.result !== 'success' || !data.rates) throw new Error('bad payload')

    const rates: RateMap = {}
    for (const [code, perKrw] of Object.entries(data.rates)) {
      // "1 KRW = perKrw 외화" → "1 외화 = 1/perKrw 원"
      if (perKrw > 0) rates[code] = 1 / perKrw
    }

    const result: ExchangeRatesResult = {
      rates,
      updatedAt: (data.time_last_update_unix ?? 0) * 1000,
    }
    writeCache(result)
    return result
  } catch {
    return { rates: {}, updatedAt: 0 }
  }
}

// ── 대시보드 환율 카드용: 값 + 전일 대비 변동률 ──────────────
/** 환율 산출 페이지의 기본 통화와 같은 목록을 쓴다 */
const PILL_CODES = ['USD', 'JPY', 'EUR', 'CNY', 'SAR', 'AED'] as const

export type PillRate = { code: string; krw: number }

/**
 * 대시보드 카드용 환율(1 외화 = ? 원). 값만 실시간, 변동%는 쓰지 않는다.
 * fetchExchangeRates 의 캐시를 그대로 재사용한다.
 * 실패 시 rates 는 빈 배열이고 updatedAt 은 0 — 호출부가 폴백임을 표시해야 한다.
 */
export async function fetchPillRates(): Promise<{ rates: PillRate[]; updatedAt: number }> {
  const { rates, updatedAt } = await fetchExchangeRates()
  return {
    rates: PILL_CODES.flatMap((code) => (rates[code] ? [{ code, krw: rates[code] }] : [])),
    updatedAt,
  }
}
