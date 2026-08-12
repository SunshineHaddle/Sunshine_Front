import { createContext, useContext, type ReactNode } from 'react'
import type { LoginRole } from './api/auth'

/**
 * 로그인 정보. Sidebar 가 9개 페이지에서 렌더되기 때문에
 * 프롭으로 내리는 대신 컨텍스트로 공유한다.
 */
type Session = {
  role: LoginRole
  userName: string
  /** 표시용 아이디. 이름과 역할 라벨이 같을 수 있어 구분용으로 함께 보여준다 */
  loginId: string
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({
  value,
  children,
}: {
  value: Session
  children: ReactNode
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** 로그인 전에는 null. Sidebar 는 null 이면 계정 영역을 감춘다 */
export function useSession() {
  return useContext(SessionContext)
}
