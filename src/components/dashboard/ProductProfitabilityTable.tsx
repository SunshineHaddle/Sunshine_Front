import type {
  ProductProfitabilityItem,
} from '../../pages/dashboard/dashboardData'

type ProductProfitabilityTableProps = {
  items: ProductProfitabilityItem[]
  /** '2026년 8월' 형태. 어느 달 스냅샷인지 표시한다 */
  periodLabel: string
  month: string
  loading?: boolean
  emptyMessage?: string
  onMonthChange: (month: string) => void
}

const numberFormatter = new Intl.NumberFormat('ko-KR')

function getQuantityUnit(specification: string) {
  const match = specification.match(/[a-zA-Z]+/)
  return match ? match[0] : 'kg'
}

export function ProductProfitabilityTable({
  items,
  periodLabel,
  month,
  loading = false,
  emptyMessage = '조건에 맞는 제품이 없습니다.',
  onMonthChange,
}: ProductProfitabilityTableProps) {
  return (
    <section className="card profitability-card" aria-labelledby="profitability-table-title">
      <div className="profitability-card__heading">
        <div>
          <h2 id="profitability-table-title">{periodLabel} 수익성 현황</h2>
          <p>포장 1개 기준 원가와 판매 마진입니다.</p>
        </div>
        <label className="profitability-card__month-picker">
          <span>기준 월</span>
          <input
            aria-label="수익성 기준 월"
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value)
            }}
          />
        </label>
      </div>

      <div className="profitability-table-scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">제품명</th>
              <th scope="col">규격</th>
              <th scope="col">생산량</th>
              <th scope="col">제조원가</th>
              <th scope="col">경영 총원가</th>
              <th scope="col">판매가</th>
              <th scope="col">마진율</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="profitability-empty" colSpan={7}>불러오는 중…</td>
              </tr>
            ) : items.length > 0 ? (
              items.map((item) => {
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="product-name">{item.name}</span>
                      {item.variant && <span className="product-variant">{item.variant}</span>}
                    </td>
                    <td>
                      <span className="metric-primary">{item.specification}</span>
                      <span className="metric-unit">/ {item.packageUnit}</span>
                    </td>
                    <td>
                      <span className="metric-primary">{numberFormatter.format(item.productionQuantity)}</span>
                      <span className="metric-unit">{getQuantityUnit(item.specification)}</span>
                    </td>
                    <td className="money-cell">₩{numberFormatter.format(item.manufacturingCost)}</td>
                    <td className="money-cell">₩{numberFormatter.format(item.totalCost)}</td>
                    <td className="money-cell money-cell--sale">₩{numberFormatter.format(item.salePrice)}</td>
                    <td>
                      {/* 판매가 0 은 마진율 0 으로 저장된다. 모르는 값을 정상처럼 보이면 안 된다 */}
                      {item.salePrice > 0 ? (
                        <span className="margin-pill">
                          {item.marginRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="margin-pill margin-pill--unknown" title="제품 관리에서 판매가를 입력해주세요">
                          판매가 미입력
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="profitability-empty" colSpan={7}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="profitability-card__footer">
        <span>총 {items.length}개 품목</span>
      </div>
    </section>
  )
}
