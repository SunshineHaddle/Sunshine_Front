import type {
  ProductProfitabilityItem,
} from '../../pages/dashboard/dashboardData'

type ProductProfitabilityTableProps = {
  items: ProductProfitabilityItem[]
}

const numberFormatter = new Intl.NumberFormat('ko-KR')

function getQuantityUnit(specification: string) {
  const match = specification.match(/[a-zA-Z]+/)
  return match ? match[0] : 'kg'
}

export function ProductProfitabilityTable({
  items,
}: ProductProfitabilityTableProps) {
  return (
    <section className="card profitability-card" aria-labelledby="profitability-table-title">
      <div className="profitability-card__heading">
        <div>
          <h2 id="profitability-table-title">이번달 수익성 현황</h2>
          <p>이달의 품목별 생산 마진을 확인하세요.</p>
        </div>
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
            {items.length > 0 ? (
              items.map((item) => {
                const marginTone = item.marginRate < 0 ? 'loss' : item.marginRate < 20 ? 'watch' : 'good'

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
                      <span className={`margin-pill margin-pill--${marginTone}`}>
                        {item.marginRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="profitability-empty" colSpan={7}>조건에 맞는 제품이 없습니다.</td>
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
