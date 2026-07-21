import type { ProcessItem } from './dashboardData'
import { Icon } from '../../components/common/Icon'


type ProcessVarianceTableProps = {
  items: ProcessItem[]
  attentionOnly: boolean
  onToggleFilter: () => void
  onViewAll: () => void
}

export function ProcessVarianceTable({
  items,
  attentionOnly,
  onToggleFilter,
  onViewAll,
}: ProcessVarianceTableProps) {
  return (
    <section className="card process-card" aria-labelledby="process-table-title">
      <div className="process-card__heading">
        <h2 id="process-table-title">
          <Icon name="trend" size={22} />
          <span>공정별 변동률 모니터링</span>
        </h2>
        <button
          aria-pressed={attentionOnly}
          className={`filter-button${attentionOnly ? ' is-active' : ''}`}
          type="button"
          onClick={onToggleFilter}
        >
          <span>{attentionOnly ? '전체' : '필터'}</span>
          <Icon name="filter" size={16} />
        </button>
      </div>

      <div className="table-scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">▥ ID</th>
              <th scope="col">공정명</th>
              <th scope="col">담당자</th>
              <th scope="col">표준 원가</th>
              <th scope="col">실제 원가</th>
              <th scope="col">변동률</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.process}</td>
                  <td>{item.owner}</td>
                  <td className="cost-cell">{item.standardCost}</td>
                  <td className="actual-cost-cell">{item.actualCost}</td>
                  <td>
                    <span className={`variance variance--${item.varianceDirection}`}>
                      {item.varianceDirection === 'up'
                        ? '↑ '
                        : item.varianceDirection === 'down'
                          ? '↓ '
                          : '− '}
                      {item.variance}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${item.status === '주의' ? 'warning' : 'normal'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-table" colSpan={7}>검색 결과가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button className="view-all-button" type="button" onClick={onViewAll}>
        전체 공정 보기
      </button>
    </section>
  )
}
