import { useState } from 'react'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { formatCompletionTime, loadLatestCompletion } from '../../utils/dataEntryLog'

type UserRole = '시스템 관리자' | '데이터 입력' | '검토자'

type ManagedUser = {
  id: string
  initial: string
  name: string
  lastActive: string
  role: UserRole
  active: boolean
}

type UserManagementPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const buildInitialUsers = (): ManagedUser[] => {
  const workerCompletion = loadLatestCompletion('worker1234')

  return [
    {
      id: 'admin-user',
      initial: 'A',
      name: '관리자 (qwer1234)',
      lastActive: '방금 전',
      role: '시스템 관리자',
      active: true,
    },
    {
      id: 'field-worker-a',
      initial: 'W',
      name: '실무자 (worker1234)',
      lastActive: workerCompletion
        ? `${formatCompletionTime(workerCompletion.completedAt)} 데이터 입력 완료`
        : '데이터 입력 대기',
      role: '데이터 입력',
      active: true,
    },
    {
      id: 'manager-b',
      initial: 'M',
      name: '매니저 B',
      lastActive: '14일 전',
      role: '검토자',
      active: false,
    },
  ]
}

const roleClassNames: Record<UserRole, string> = {
  '시스템 관리자': 'is-admin',
  '데이터 입력': 'is-entry',
  '검토자': 'is-reviewer',
}

export function UserManagementPage({
  onNavigate,
  onAction,
}: UserManagementPageProps) {
  const [users, setUsers] = useState(buildInitialUsers)

  const addUser = () => {
    const userNumber = users.length + 1
    setUsers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        initial: 'N',
        name: `신규 사용자 ${userNumber}`,
        lastActive: '초대 대기',
        role: '검토자',
        active: true,
      },
    ])
    onAction(`신규 사용자 ${userNumber}을(를) 추가했습니다.`)
  }

  const toggleUser = (userId: string) => {
    setUsers((current) => current.map((user) => (
      user.id === userId ? { ...user, active: !user.active } : user
    )))

    const target = users.find((user) => user.id === userId)
    if (target) {
      onAction(`${target.name} 계정을 ${target.active ? '비활성화' : '활성화'}했습니다.`)
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
              <p>시스템 액세스 관리, 역할 할당 및 팀 전체의 최근 활동을 모니터링합니다.</p>
            </div>
            <button className="user-add-button" type="button" onClick={addUser}>
              <Icon name="users" size={16} />
              신규 사용자 추가
            </button>
          </header>

          <div className="user-table" role="table" aria-label="사용자 및 권한 목록">
            <div className="user-table__header" role="row">
              <span role="columnheader">성함</span>
              <span role="columnheader">역할</span>
              <span role="columnheader">상태</span>
              <span role="columnheader">관리</span>
            </div>

            <div className="user-table__body" role="rowgroup">
              {users.map((user) => (
                <div className={`user-row${user.active ? '' : ' is-inactive'}`} role="row" key={user.id}>
                  <div className="user-identity" role="cell">
                    <span className="user-avatar" aria-hidden="true">{user.initial}</span>
                    <div>
                      <strong>{user.name}</strong>
                      <small>마지막 접속: {user.lastActive}</small>
                    </div>
                  </div>

                  <div role="cell">
                    <span className={`user-role ${roleClassNames[user.role]}`}>{user.role}</span>
                  </div>

                  <div role="cell">
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
                  </div>

                  <div role="cell">
                    <button
                      className="user-edit-button"
                      type="button"
                      onClick={() => onAction(`${user.name}의 권한 수정 기능을 준비 중입니다.`)}
                    >
                      수정
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
