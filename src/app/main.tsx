import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/base.css'
import App from './App.tsx'
import { ErrorBoundary } from '../components/common/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 렌더링 중 예외가 나면 흰 화면 대신 안내를 띄운다 */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
