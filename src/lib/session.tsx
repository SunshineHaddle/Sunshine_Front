import type { ReactNode } from 'react'
import { SessionContext, type Session } from './sessionContext'

export function SessionProvider({
  value,
  children,
}: {
  value: Session
  children: ReactNode
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
