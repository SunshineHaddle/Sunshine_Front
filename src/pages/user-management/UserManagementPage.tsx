import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { changePassword, fetchProfiles, setProfileActive } from '../../lib/api/auth'
import { fetchFileHistory, type FileHistoryItem } from '../../lib/api/files'
import { describeDbError } from '../../lib/api/errors'
import type { ProfileRow, UserRole } from '../../lib/types'

type UserManagementPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

/** 이력에 보여줄 최대 건수. 그 이상은 화면이 길어지기만 한다 */
const HISTORY_LIMIT = 20

/** 접힌 상태에서 보여줄 건수. 그 이상은 "더 보기" 로 펼친다 */
const HISTORY_PREVIEW = 5

/** 비밀번호 최소 길이 (Supabase Auth 기본 최소값과 동일) */
const PASSWORD_MIN_LENGTH = 6

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
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // 비밀번호 변경 팝업 — 대상 사용자가 있으면 열린 상태
  const [passwordTarget, setPasswordTarget] = useState<ProfileRow | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

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

  const openPasswordModal = (user: ProfileRow) => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSaving(false)
    setPasswordTarget(user)
  }

  const closePasswordModal = useCallback(() => {
    setPasswordTarget(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSaving(false)
  }, [])

  useEffect(() => {
    if (!passwordTarget) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePasswordModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [passwordTarget, closePasswordModal])

  const validatePassword = (): string => {
    if (!currentPassword) return '기존 비밀번호를 입력해주세요.'
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
    }
    if (newPassword !== confirmPassword) return '새 비밀번호가 서로 일치하지 않습니다.'
    if (newPassword === currentPassword) return '새 비밀번호가 기존 비밀번호와 같습니다.'
    return ''
  }

  // 기존 비밀번호 대조는 Auth 로그인 시도로 한다 (auth.ts changePassword 참고)
  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordSaving) return
    const message = validatePassword()
    setPasswordError(message)
    if (message || !passwordTarget) return

    setPasswordSaving(true)
    try {
      const result = await changePassword(passwordTarget.login_id, currentPassword, newPassword)
      if (result === 'wrong_password') {
        setPasswordError('기존 비밀번호가 올바르지 않습니다.')
        setCurrentPassword('')
        return
      }
      if (result !== 'ok') {
        setPasswordError('비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      onAction(`${passwordTarget.name} 계정의 비밀번호를 변경했습니다.`)
      closePasswordModal()
    } catch (error) {
      setPasswordError(`변경 실패: ${describeDbError(error)}`)
    } finally {
      setPasswordSaving(false)
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
              <span role="columnheader">비밀번호</span>
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
                    <span className={`user-role ${ROLE_CLASS[user.role]}`}>
                      {ROLE_LABEL[user.role]}
                    </span>
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

                  <div role="cell">
                    <button
                      className="user-password-button"
                      type="button"
                      aria-label={`${user.name} 비밀번호 변경`}
                      onClick={() => openPasswordModal(user)}
                    >
                      비밀번호 변경
                    </button>
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
                {(historyExpanded ? history : history.slice(0, HISTORY_PREVIEW)).map((item, index) => (
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

            {!historyLoading && history.length > HISTORY_PREVIEW && (
              <button
                className="entry-history__toggle"
                type="button"
                aria-expanded={historyExpanded}
                onClick={() => setHistoryExpanded((prev) => !prev)}
              >
                {historyExpanded
                  ? '접기'
                  : `더 보기 (${history.length - HISTORY_PREVIEW}건 더)`}
                <Icon name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
              </button>
            )}
          </section>
        </section>
      </main>

      {passwordTarget && (
        <div
          className="password-modal__backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePasswordModal()
          }}
        >
          <div
            className="password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
          >
            <header className="password-modal__header">
              <h2 id="password-modal-title">비밀번호 변경</h2>
              <button
                className="password-modal__close"
                type="button"
                aria-label="닫기"
                onClick={closePasswordModal}
              >
                ×
              </button>
            </header>
            <p className="password-modal__description">
              <strong>{passwordTarget.name} ({passwordTarget.login_id})</strong> 계정의 비밀번호를 변경합니다.
              기존 비밀번호가 맞아야 새 비밀번호로 바뀝니다.
            </p>

            <form className="password-modal__form" onSubmit={(event) => void handlePasswordSubmit(event)} noValidate>
              <label>
                <span>기존 비밀번호</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={currentPassword}
                  placeholder="현재 사용 중인 비밀번호"
                  disabled={passwordSaving}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>

              <hr className="password-modal__divider" />

              <label>
                <span>새 비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  disabled={passwordSaving}
                  placeholder={`${PASSWORD_MIN_LENGTH}자 이상`}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={passwordSaving}
                  placeholder="새 비밀번호 다시 입력"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>

              {passwordError && (
                <p className="password-modal__error" role="alert">{passwordError}</p>
              )}

              <div className="password-modal__actions">
                <button
                  className="password-modal__cancel"
                  type="button"
                  disabled={passwordSaving}
                  onClick={closePasswordModal}
                >
                  취소
                </button>
                <button className="password-modal__submit" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? '변경 중…' : '변경하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
