import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { fetchProfiles, setProfileActive, setProfileRole } from '../../lib/api/auth'
import { fetchFileHistory, type FileHistoryItem } from '../../lib/api/files'
import { describeDbError } from '../../lib/api/errors'
import type { ProfileRow, UserRole } from '../../lib/types'

type UserManagementPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

/** 이력에 보여줄 최대 건수. 그 이상은 화면이 길어지기만 한다 */
const HISTORY_LIMIT = 20

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '시스템 관리자',
  entry: '데이터 입력',
  reviewer: '검토자',
}

const ROLE_CLASS: Record<UserRole, string> = {
  admin: 'is-admin',
  entry: 'is-entry',
  reviewer: 'is-reviewer',
}

function formatLastActive(iso: string | null) {
  if (!iso) return '접속 기록 없음'
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** 'YYYY-MM-01' → '2026년 8월'. period 가 없는 업로드도 있어 null 을 받는다 */
function formatPeriod(period: string | null) {
  if (!period) return '월 미지정'
  return `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월`
}

export function UserManagementPage({
  onNavigate,
  onAction,
}: UserManagementPageProps) {
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [history, setHistory] = useState<FileHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // §11-4 : setState 는 await 뒤에서만 (이펙트 본문 동기 setState 금지)
  const reload = useCallback(async () => {
    const rows = await fetchProfiles().catch((): ProfileRow[] => [])
    setUsers(rows)
  }, [])

  useEffect(() => { void (async () => { await reload() })() }, [reload])

  // §10-3 : 데이터 입력 이력 = 수불자료 업로드 이력 (file_uploads)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchFileHistory({ limit: HISTORY_LIMIT })
        .catch((): FileHistoryItem[] => [])
      if (cancelled) return
      setHistory(rows)
      setHistoryLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // §11-5 : 관리자가 아니면 RLS 가 조용히 0행 처리하므로 반환값으로 확인한다
  const toggleUser = async (user: ProfileRow) => {
    const next = !user.is_active
    try {
      if (!(await setProfileActive(user.id, next))) {
        onAction('권한이 없어 변경되지 않았습니다. 관리자만 수정할 수 있습니다.')
        return
      }
      await reload()
      onAction(`${user.name} 계정을 ${next ? '활성화' : '비활성화'}했습니다.`)
    } catch (error) {
      onAction(`변경 실패: ${describeDbError(error)}`)
    }
  }

  const changeRole = async (user: ProfileRow, role: UserRole) => {
    if (role === user.role) return
    try {
      if (!(await setProfileRole(user.id, role))) {
        onAction('권한이 없어 변경되지 않았습니다. 관리자만 수정할 수 있습니다.')
        return
      }
      await reload()
      onAction(`${user.name}의 역할을 ${ROLE_LABEL[role]}(으)로 변경했습니다.`)
    } catch (error) {
      onAction(`변경 실패: ${describeDbError(error)}`)
    }
  }

  return (
    <div className="dashboard-app user-management-layout">
      <Sidebar activeRoute="user-management" onNavigate={onNavigate} />

      <main className="user-management-page">
        <section className="user-management-content" aria-labelledby="user-management-title">
          <header className="user-management-header">
            <div>
              <h1 id="user-management-title">사용자 및 권한 관리</h1>
              <p>시스템 액세스 관리, 역할 할당 및 실무자의 데이터 입력 이력을 관리합니다.</p>
            </div>
          </header>

          <div className="user-table" role="table" aria-label="사용자 및 권한 목록">
            <div className="user-table__header" role="row">
              <span role="columnheader">성함</span>
              <span role="columnheader">역할</span>
              <span role="columnheader">상태</span>
            </div>

            <div className="user-table__body" role="rowgroup">
              {users.length === 0 && (
                <p className="user-table__empty" role="status">
                  등록된 사용자가 없습니다. Supabase 콘솔에서 계정을 만든 뒤 profiles 에 연결해주세요.
                </p>
              )}
              {users.map((user) => (
                <div className={`user-row${user.is_active ? '' : ' is-inactive'}`} role="row" key={user.id}>
                  <div className="user-identity" role="cell">
                    <div>
                      <strong>{user.name} ({user.login_id})</strong>
                      <small>마지막 접속: {formatLastActive(user.last_active_at)}</small>
                    </div>
                  </div>

                  <div role="cell">
                    <select
                      className={`user-role user-role--select ${ROLE_CLASS[user.role]}`}
                      aria-label={`${user.name} 역할`}
                      value={user.role}
                      onChange={(event) => void changeRole(user, event.target.value as UserRole)}
                    >
                      {(Object.keys(ROLE_LABEL) as UserRole[]).map((key) => (
                        <option key={key} value={key}>{ROLE_LABEL[key]}</option>
                      ))}
                    </select>
                  </div>

                  <div role="cell">
                    {/* 관리자를 비활성화하면 아무도 쓰기를 못 하게 되므로 막는다 */}
                    {user.role !== 'admin' && (
                      <button
                        className={`user-status-switch${user.is_active ? ' is-active' : ''}`}
                        type="button"
                        role="switch"
                        aria-checked={user.is_active}
                        aria-label={`${user.name} 계정 ${user.is_active ? '비활성화' : '활성화'}`}
                        onClick={() => void toggleUser(user)}
                      >
                        <span />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="entry-history" aria-labelledby="entry-history-title">
            <header className="entry-history__heading">
              <div>
                <h2 id="entry-history-title">데이터 입력 히스토리</h2>
                <p>수불자료 업로드 이력입니다. 값을 고치려면 데이터 입력 3단계에서 마감을 취소하세요.</p>
              </div>
              <span className="entry-history__count">{history.length}건</span>
            </header>

            {historyLoading ? (
              <p className="entry-history__empty" role="status">불러오는 중…</p>
            ) : history.length === 0 ? (
              <p className="entry-history__empty">
                아직 업로드된 수불자료가 없습니다. 데이터 입력 1단계에서 엑셀을 올리면 여기에 쌓입니다.
              </p>
            ) : (
              <ol className="entry-history__list">
                {history.map((item, index) => (
                  <li className="entry-history__item" key={item.id}>
                    <div className="entry-history__info">
                      <span className="entry-history__badge" aria-hidden="true">
                        <Icon name="check" size={13} />
                      </span>
                      <div>
                        <strong>
                          {formatLastActive(item.uploaded_at)} · {formatPeriod(item.period)} 수불자료 업로드
                        </strong>
                        <small>
                          {item.uploaderName
                            ? `${item.uploaderName}(${item.uploaderLoginId})`
                            : '업로더 미상'}
                          {' · '}{item.original_name}
                          {item.row_count !== null && ` · ${item.row_count}행`}
                          {index === 0 && ' · 최신'}
                        </small>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
