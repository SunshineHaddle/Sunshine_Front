import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import {
  formatCompletionTime,
  loadCompletionHistory,
  loadLatestCompletion,
  revertToCompletion,
  type DataEntryCompletion,
} from '../../utils/dataEntryLog'

type UserRole = '시스템 관리자' | '데이터 입력'

type ManagedUser = {
  id: string
  name: string
  lastActive: string
  role: UserRole
  active: boolean
}

type UserManagementPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const WORKER_ACCOUNT = 'worker1234'

const buildInitialUsers = (): ManagedUser[] => {
  const workerCompletion = loadLatestCompletion(WORKER_ACCOUNT)

  return [
    {
      id: 'admin-user',
      name: '관리자 (qwer1234)',
      lastActive: '방금 전',
      role: '시스템 관리자',
      active: true,
    },
    {
      id: 'field-worker-a',
      name: '실무자 (worker1234)',
      lastActive: workerCompletion
        ? `${formatCompletionTime(workerCompletion.completedAt)} 데이터 입력 완료`
        : '데이터 입력 대기',
      role: '데이터 입력',
      active: true,
    },
  ]
}

const roleClassNames: Record<UserRole, string> = {
  '시스템 관리자': 'is-admin',
  '데이터 입력': 'is-entry',
}

export function UserManagementPage({
  onNavigate,
  onAction,
}: UserManagementPageProps) {
  const [users, setUsers] = useState(buildInitialUsers)
  const [history, setHistory] = useState<DataEntryCompletion[]>(() => loadCompletionHistory(WORKER_ACCOUNT))

  const toggleUser = (userId: string) => {
    setUsers((current) => current.map((user) => (
      user.id === userId ? { ...user, active: !user.active } : user
    )))

    const target = users.find((user) => user.id === userId)
    if (target) {
      onAction(`${target.name} 계정을 ${target.active ? '비활성화' : '활성화'}했습니다.`)
    }
  }

  const handleRevert = (completion: DataEntryCompletion) => {
    revertToCompletion(completion.id)
    const next = loadCompletionHistory(WORKER_ACCOUNT)
    setHistory(next)
    onAction(`${formatCompletionTime(completion.completedAt)} 시점으로 데이터 입력 히스토리를 되돌렸습니다.`)
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
              {users.map((user) => (
                <div className={`user-row${user.active ? '' : ' is-inactive'}`} role="row" key={user.id}>
                  <div className="user-identity" role="cell">
                    <div>
                      <strong>{user.name}</strong>
                      <small>마지막 접속: {user.lastActive}</small>
                    </div>
                  </div>

                  <div role="cell">
                    <span className={`user-role ${roleClassNames[user.role]}`}>{user.role}</span>
                  </div>

                  <div role="cell">
                    {user.role !== '시스템 관리자' && (
                      <button
                        className={`user-status-switch${user.active ? ' is-active' : ''}`}
                        type="button"
                        role="switch"
                        aria-checked={user.active}
                        aria-label={`${user.name} 계정 ${user.active ? '비활성화' : '활성화'}`}
                        onClick={() => toggleUser(user.id)}
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
                <p>실무자(worker1234)의 데이터 입력 완료 이력입니다. 특정 시점으로 되돌릴 수 있습니다.</p>
              </div>
              <span className="entry-history__count">{history.length}건</span>
            </header>

            {history.length === 0 ? (
              <p className="entry-history__empty">아직 기록된 데이터 입력 이력이 없습니다.</p>
            ) : (
              <ol className="entry-history__list">
                {history.map((completion, index) => (
                  <li className="entry-history__item" key={completion.id}>
                    <div className="entry-history__info">
                      <span className="entry-history__badge" aria-hidden="true">
                        <Icon name="check" size={13} />
                      </span>
                      <div>
                        <strong>{formatCompletionTime(completion.completedAt)} 데이터 입력 완료</strong>
                        <small>{index === 0 ? '최신 입력' : `${index}번째 이전 입력`}</small>
                      </div>
                    </div>
                    <button
                      className="entry-history__revert"
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleRevert(completion)}
                    >
                      <Icon name="chevron-left" size={14} /> 이 시점으로 되돌리기
                    </button>
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
