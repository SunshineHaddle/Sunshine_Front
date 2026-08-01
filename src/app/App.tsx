import { useEffect, useRef, useState, type ReactNode } from 'react'
import '../styles/dashboard.css'
import '../styles/workflow.css'
import '../styles/product-management.css'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import {
  hashForRoute,
  routeFromHash,
  type AppRoute,
} from '../data/navigation'
import { OperatingCostEntryPage } from '../pages/operating-cost-entry/OperatingCostEntryPage'
import { ProductionResultPage } from '../pages/production-result/ProductionResultPage'
import { RawMaterialEntryPage } from '../pages/raw-material-entry/RawMaterialEntryPage'
import { InsightDetailPage } from '../pages/dashboard/InsightDetailPage'
import { ProductManagementPage } from '../pages/product-management/ProductManagementPage'
import { ProductCreatePage } from '../pages/product-management/ProductCreatePage'
import {
  initialRecipeProducts,
  RECIPE_PRODUCTS_STORAGE_KEY,
  type RecipeProduct,
} from '../pages/product-management/productManagementData'
import { ProductDetailPage } from '../pages/product-management/ProductDetailPage'
import { ExchangeRateCalculatorPage } from '../pages/exchange-rate/ExchangeRateCalculatorPage'
import { UserManagementPage } from '../pages/user-management/UserManagementPage'
import { LoginPage, type LoginRole } from '../pages/login/LoginPage'
import '../styles/exchange-rate.css'
import '../styles/user-management.css'
import '../styles/login.css'

const SELECTED_PRODUCT_STORAGE_KEY = 'sunshine.selected-recipe-product'

function loadRecipeProducts() {
  if (typeof window === 'undefined') return initialRecipeProducts

  try {
    const storedProducts = JSON.parse(
      window.localStorage.getItem(RECIPE_PRODUCTS_STORAGE_KEY) ?? 'null',
    ) as RecipeProduct[] | null
    if (
      Array.isArray(storedProducts) &&
      storedProducts.length > 0 &&
      storedProducts.every((product) => Array.isArray(product.ingredients))
    ) {
      return storedProducts.map((product) => ({
        ...product,
        ingredients: product.ingredients.map((ingredient) => ({ ...ingredient, unit: 'kg' as const })),
      }))
    }
  } catch {
    return initialRecipeProducts
  }

  return initialRecipeProducts
}

function App() {
  const [loginRole, setLoginRole] = useState<LoginRole | null>(null)
  const [route, setRoute] = useState<AppRoute>(() =>
    routeFromHash(typeof window === 'undefined' ? '' : window.location.hash),
  )
  const [message, setMessage] = useState('')
  const [recipeProducts, setRecipeProducts] = useState<RecipeProduct[]>(loadRecipeProducts)
  const [selectedProductId, setSelectedProductId] = useState(() =>
    typeof window === 'undefined'
      ? initialRecipeProducts[0].id
      : window.localStorage.getItem(SELECTED_PRODUCT_STORAGE_KEY) ?? initialRecipeProducts[0].id,
  )
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

  useEffect(() => {
    window.localStorage.setItem(RECIPE_PRODUCTS_STORAGE_KEY, JSON.stringify(recipeProducts))
  }, [recipeProducts])

  useEffect(() => {
    window.localStorage.setItem(SELECTED_PRODUCT_STORAGE_KEY, selectedProductId)
  }, [selectedProductId])

  const announce = (nextMessage: string) => {
    window.clearTimeout(messageTimer.current)
    setMessage(nextMessage)
    messageTimer.current = window.setTimeout(() => setMessage(''), 2600)
  }

  const navigate = (nextRoute: AppRoute) => {
    if (loginRole === 'worker' && nextRoute !== 'dashboard') return
    setRoute(nextRoute)
    const nextHash = hashForRoute(nextRoute)
    if (window.location.hash !== nextHash) window.location.hash = nextHash
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!loginRole) {
    return (
      <LoginPage
        onLogin={(role) => {
          setLoginRole(role)
          if (role === 'worker') navigate('dashboard')
        }}
      />
    )
  }

  let page: ReactNode

  if (loginRole === 'worker') {
    page = (
      <DashboardPage
        isWorker
        recipeProducts={recipeProducts}
        onNavigate={navigate}
        onAction={announce}
        onSelectRecipe={() => {}}
      />
    )
  } else if (route === 'data-entry-1') {
    page = <RawMaterialEntryPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'data-entry-2') {
    page = <OperatingCostEntryPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'data-entry-3') {
    page = <ProductionResultPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'product-management') {
    page = (
      <ProductManagementPage
        products={recipeProducts}
        onNavigate={navigate}
        onSelectProduct={(productId) => {
          setSelectedProductId(productId)
          navigate('product-detail')
        }}
      />
    )
  } else if (route === 'product-create') {
    page = (
      <ProductCreatePage
        nextProductNumber={recipeProducts.length + 1}
        onNavigate={navigate}
        onAction={announce}
        onCreate={(product) => {
          setRecipeProducts((current) => [product, ...current])
          announce(`${product.name} 레시피를 저장했습니다.`)
          navigate('product-management')
        }}
      />
    )
  } else if (route === 'product-detail') {
    const selectedProduct = recipeProducts.find((product) => product.id === selectedProductId)
      ?? recipeProducts[0]
    page = (
      <ProductDetailPage
        product={selectedProduct}
        onNavigate={navigate}
        onAction={announce}
      />
    )
  } else if (route === 'exchange-rate-detail') {
    page = <ExchangeRateCalculatorPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'user-management') {
    page = <UserManagementPage onNavigate={navigate} onAction={announce} />
  } else if (route === 'defect-status-detail') {
    page = <InsightDetailPage route={route} onNavigate={navigate} />
  } else {
    page = (
      <DashboardPage
        recipeProducts={recipeProducts}
        onNavigate={navigate}
        onAction={announce}
        onSelectRecipe={(productId) => {
          setSelectedProductId(productId)
          navigate('product-detail')
        }}
      />
    )
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
