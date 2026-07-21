import { useEffect, useRef, useState, type ReactNode } from 'react'
import '../styles/dashboard.css'
import '../styles/workflow.css'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import {
  hashForRoute,
  routeFromHash,
  type AppRoute,
} from '../data/navigation'
import { OperatingCostEntryPage } from '../pages/operating-cost-entry/OperatingCostEntryPage'
import { ProductionResultPage } from '../pages/production-result/ProductionResultPage'
import { RawMaterialEntryPage } from '../pages/raw-material-entry/RawMaterialEntryPage'

function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    routeFromHash(typeof window === 'undefined' ? '' : window.location.hash),
  )
  const [message, setMessage] = useState('')
  const messageTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#dashboard')
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.clearTimeout(messageTimer.current)
    }
  }, [])

  const announce = (nextMessage: string) => {
    window.clearTimeout(messageTimer.current)
    setMessage(nextMessage)
    messageTimer.current = window.setTimeout(() => setMessage(''), 2600)
  }

  const navigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute)
    const nextHash = hashForRoute(nextRoute)
    if (window.location.hash !== nextHash) window.location.hash = nextHash
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  let page: ReactNode

  if (route === 'data-entry-1') {
    page = <RawMaterialEntryPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'data-entry-2') {
    page = <OperatingCostEntryPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'data-entry-3') {
    page = <ProductionResultPage onNavigate={navigate} onAction={announce} />
  } else {
    page = <DashboardPage onNavigate={navigate} onAction={announce} />
  }

  return (
    <>
      {page}
      <div
        className={`toast${message ? ' is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </>
  )
}

export default App
