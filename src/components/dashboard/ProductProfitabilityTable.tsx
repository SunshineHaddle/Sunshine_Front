import { useState } from 'react'
import { Icon } from '../common/Icon'
import type {
  ProductProfitabilityItem,
  ProductStatus,
} from '../../pages/dashboard/dashboardData'

type ProductProfitabilityTableProps = {
  items: ProductProfitabilityItem[]
  attentionOnly: boolean
  onToggleFilter: () => void
  onExport: () => void
}

const PAGE_SIZE = 5

const statusLabels: Record<ProductStatus, string> = {
  normal: '정상',
  watch: '주의',
  risk: '위험',
}

const numberFormatter = new Intl.NumberFormat('ko-KR')

export function ProductProfitabilityTable({
  items,
  attentionOnly,
  onToggleFilter,
  onExport,
}: ProductProfitabilityTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const visiblePage = Math.min(currentPage, totalPages)
  const pageItems = items.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)

  const moveToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages))
  }

  return (
    <section className="card profitability-card" aria-labelledby="profitability-table-title">
      <div className="profitability-card__heading">
        <div>
          <h2 id="profitability-table-title">제품별 수익성 현황</h2>
          <p>이달의 품목별 생산 마진과 수율을 확인하세요.</p>
        </div>

        <div className="profitability-card__actions">
          <button
            aria-pressed={attentionOnly}
            className={`table-action${attentionOnly ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setCurrentPage(1)
              onToggleFilter()
            }}
          >
            <Icon name="filter" size={14} />
            <span>필터</span>
          </button>
          <button className="table-action" type="button" onClick={onExport}>
            <Icon name="download" size={14} />
            <span>내보내기</span>
          </button>
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
              <th scope="col">수율</th>
              <th scope="col">불량률</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length > 0 ? (
              pageItems.map((item) => {
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
                      <span className="metric-unit">ea</span>
                    </td>
                    <td className="money-cell">₩{numberFormatter.format(item.manufacturingCost)}</td>
                    <td className="money-cell">₩{numberFormatter.format(item.totalCost)}</td>
                    <td className="money-cell money-cell--sale">₩{numberFormatter.format(item.salePrice)}</td>
                    <td>
                      <span className={`margin-pill margin-pill--${marginTone}`}>
                        {item.marginRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="rate-cell">{item.yieldRate.toFixed(1)}%</td>
                    <td className={`defect-cell defect-cell--${item.status}`}>
                      {item.defectRate.toFixed(1)}%
                    </td>
                    <td>
                      <span
                        className={`product-status product-status--${item.status}`}
                        title={statusLabels[item.status]}
                      >
                        <span className="visually-hidden">{statusLabels[item.status]}</span>
                      </span>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="profitability-empty" colSpan={10}>조건에 맞는 제품이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="profitability-card__footer">
        <span>총 124개 품목</span>
        <nav className="table-pagination" aria-label="제품 목록 페이지">
          <button
            aria-label="이전 페이지"
            disabled={visiblePage === 1}
            type="button"
            onClick={() => moveToPage(visiblePage - 1)}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              aria-current={page === visiblePage ? 'page' : undefined}
              className={page === visiblePage ? 'is-current' : ''}
              key={page}
              type="button"
              onClick={() => moveToPage(page)}
            >
              {page}
            </button>
          ))}
          <button
            aria-label="다음 페이지"
            disabled={visiblePage === totalPages}
            type="button"
            onClick={() => moveToPage(visiblePage + 1)}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </nav>
      </div>
    </section>
  )
}
