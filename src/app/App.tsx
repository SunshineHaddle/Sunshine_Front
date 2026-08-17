import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { ProductManagementPage } from '../pages/product-management/ProductManagementPage'
import { ProductCreatePage } from '../pages/product-management/ProductCreatePage'
import type {
  IngredientCatalogItem,
  RecipeProduct,
} from '../pages/product-management/productManagementData'
import {
  createProductWithRecipe,
  deactivateProduct,
  fetchMaterials,
  fetchProducts,
  updateProduct,
} from '../lib/api/products'
import { ensurePeriod } from '../lib/api/periods'
import { fetchRecipeCostSummary, type RecipeCostSummary } from '../lib/api/results'
import type { CostPeriodRow } from '../lib/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchMyProfile, getSessionUserId, signOut, toLoginRole } from '../lib/api/auth'
import { SessionProvider } from '../lib/session'
import { isEntrySavedBeforeSession, refreshEntrySavedSnapshot } from '../utils/entrySaved'

import { ProductDetailPage } from '../pages/product-management/ProductDetailPage'
import { ExchangeRateCalculatorPage } from '../pages/exchange-rate/ExchangeRateCalculatorPage'
import { UserManagementPage } from '../pages/user-management/UserManagementPage'
import { LoginPage, type LoginRole } from '../pages/login/LoginPage'
import '../styles/exchange-rate.css'
import '../styles/user-management.css'
import '../styles/login.css'
import '../styles/data-entry.css'

const SELECTED_PRODUCT_STORAGE_KEY = 'sunshine.selected-recipe-product'

function EmptyState({ message }: { message: string }) {
  return <div className="app-empty-state" role="status"><p>{message}</p></div>
}

function App() {
  const [loginRole, setLoginRole] = useState<LoginRole | null>(null)
  const [userName, setUserName] = useState('')
  const [loginId, setLoginId] = useState('')
  /** 새로고침 후 세션 복구가 끝날 때까지 로그인 화면을 띄우지 않는다 */
  const [authChecked, setAuthChecked] = useState(false)
  const [route, setRoute] = useState<AppRoute>(() =>
    routeFromHash(typeof window === 'undefined' ? '' : window.location.hash),
  )
  const [message, setMessage] = useState('')
  const [recipeProducts, setRecipeProducts] = useState<RecipeProduct[]>([])
  const [materials, setMaterials] = useState<IngredientCatalogItem[]>([])
  const [loadError, setLoadError] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(SELECTED_PRODUCT_STORAGE_KEY) ?? '',
  )
  // 데이터 입력 1·2단계가 공유하는 기준 월. 'YYYY-MM' (F-10)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [period, setPeriod] = useState<CostPeriodRow | null>(null)
  const messageTimer = useRef<number | undefined>(undefined)

  /** §3-1 제품 목록을 다시 읽는다. 생성·수정 후에 호출한다. */
  const reloadProducts = useCallback(async () => {
    try {
      const [products, recipeCosts] = await Promise.all([
        fetchProducts(),
        // §9-3 : 재료비는 DB 집계값을 신뢰한다. 클라이언트 합산과 어긋나면 이쪽이 맞다.
        // 실패해도 제품 목록은 살려야 하므로 빈 배열로 흘린다 (타입은 명시해야 유니온이 안 생긴다)
        fetchRecipeCostSummary().catch((): RecipeCostSummary[] => []),
      ])
      const costById = new Map(recipeCosts.map((row) => [row.productId, row] as const))
      setRecipeProducts(
        products.map((product) => {
          const agg = costById.get(product.id)
          return agg
            ? { ...product, materialCost: agg.materialCost, ingredientCount: agg.ingredientCount }
            : product
        }),
      )
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  /** §4-1 해당 월 회차를 확보한다. 마감·마감취소 후에도 호출한다. */
  const refreshPeriod = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const next = await ensurePeriod(month)
      setPeriod(next)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [month])

  // §11-2 : 새로고침해도 세션이 남아 있으면 로그인 상태를 되살린다
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const userId = isSupabaseConfigured ? await getSessionUserId() : null
      const profile = userId ? await fetchMyProfile(userId) : null
      if (cancelled) return
      if (profile?.is_active) {
        setLoginRole(toLoginRole(profile.role))
        setUserName(profile.name)
        setLoginId(profile.login_id)
      }
      setAuthChecked(true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#dashboard')
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.clearTimeout(messageTimer.current)
    }
  }, [])

  // §3-1 제품 · §2-1 원재료를 Supabase 에서 불러온다.
  // RLS 때문에 로그인 전에 조회하면 조용히 0행이 온다. 반드시 세션이 선 뒤에 부른다.
  useEffect(() => {
    if (!isSupabaseConfigured || !loginRole) return
    let cancelled = false

    void (async () => {
      await reloadProducts()
      if (cancelled) return
      try {
        const items = await fetchMaterials()
        if (!cancelled) setMaterials(items)
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
      }
    })()

    return () => { cancelled = true }
  }, [reloadProducts, loginRole])

  useEffect(() => {
    if (!isSupabaseConfigured || !loginRole) return
    let cancelled = false

    void (async () => {
      try {
        const next = await ensurePeriod(month)
        if (!cancelled) setPeriod(next)
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
      }
    })()

    return () => { cancelled = true }
  }, [month, loginRole])

  useEffect(() => {
    window.localStorage.setItem(SELECTED_PRODUCT_STORAGE_KEY, selectedProductId)
  }, [selectedProductId])

  // .env 누락은 렌더마다 같은 결과라 state 로 둘 이유가 없다.
  // 이펙트에서 setState 하면 재렌더가 한 번 더 생긴다.
  const displayError = isSupabaseConfigured
    ? loadError
    : '.env 의 VITE_SUPABASE_ANON_KEY 를 채워주세요.'

  const announce = (nextMessage: string) => {
    window.clearTimeout(messageTimer.current)
    setMessage(nextMessage)
    messageTimer.current = window.setTimeout(() => setMessage(''), 2600)
  }

  const handleSignOut = async () => {
    await signOut()
    // 로그아웃을 새 세션 경계로 삼아, 그동안 저장한 회차는 재로그인 후 빈 폼으로 시작하게 한다
    refreshEntrySavedSnapshot()
    setLoginRole(null)
    setUserName('')
    setLoginId('')
    setRecipeProducts([])
    setPeriod(null)
  }

  const workerAllowedRoutes: AppRoute[] = ['data-entry-1', 'data-entry-2']

  const navigate = (nextRoute: AppRoute) => {
    if (loginRole === 'worker' && !workerAllowedRoutes.includes(nextRoute)) return
    setRoute(nextRoute)
    const nextHash = hashForRoute(nextRoute)
    if (window.location.hash !== nextHash) window.location.hash = nextHash
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!authChecked) {
    return <div className="app-empty-state" role="status"><p>불러오는 중…</p></div>
  }

  if (!loginRole) {
    return (
      <LoginPage
        onLogin={(role, name, id) => {
          setLoginRole(role)
          setUserName(name)
          setLoginId(id)
          if (role === 'worker') navigate('data-entry-1')
        }}
      />
    )
  }

  const entryProps = {
    products: recipeProducts,
    month,
    periodId: period?.id ?? null,
    // 빈 폼으로 시작하는 조건:
    //  - worker 는 항상 (저장은 DB 에 남지만 화면은 안 불러옴)
    //  - admin 은 이 회차를 이미 저장 완료한 경우 (재접속 시 빈 폼, 아직이면 이전 자료)
    freshEntry: loginRole === 'worker' || isEntrySavedBeforeSession(period?.id ?? null),
    onMonthChange: setMonth,
    onNavigate: navigate,
    onAction: announce,
    // 1단계에서 수불자료 시트명으로 제품을 만들면 목록을 다시 읽어야 한다
    onProductsChanged: reloadProducts,
  }

  let page: ReactNode

  if (loginRole === 'worker') {
    page =
      route === 'data-entry-2' ? (
        <OperatingCostEntryPage {...entryProps} />
      ) : (
        <RawMaterialEntryPage {...entryProps} />
      )
  } else if (route === 'data-entry-1') {
    page = <RawMaterialEntryPage {...entryProps} />
  } else if (route === 'data-entry-2') {
    page = <OperatingCostEntryPage {...entryProps} />
  } else if (route === 'data-entry-3') {
    page = (
      <ProductionResultPage
        month={month}
        periodId={period?.id ?? null}
        isLocked={period?.status === 'confirmed'}
        onNavigate={navigate}
        onAction={announce}
        onPeriodChanged={() => void refreshPeriod()}
      />
    )
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
        catalog={materials}
        onNavigate={navigate}
        onAction={announce}
        onCreate={(product) => {
          // §3-3 : 제품과 배합을 한 트랜잭션으로 저장한다
          void createProductWithRecipe({
            sku: `SKU-${new Date().getFullYear()}-${String(recipeProducts.length + 1).padStart(3, '0')}`,
            name: product.name,
            description: product.description,
            items: product.ingredients.flatMap((ingredient) =>
              ingredient.materialId
                ? [{
                    materialId: ingredient.materialId,
                    usage: ingredient.usage,
                    unit: ingredient.unit,
                    unitPrice: ingredient.unitPrice ?? 0,
                  }]
                : [],
            ),
          })
            .then(async () => {
              await reloadProducts()
              announce(`${product.name} 레시피를 저장했습니다.`)
              navigate('product-management')
            })
            .catch((error: unknown) =>
              announce(`저장 실패: ${error instanceof Error ? error.message : String(error)}`),
            )
        }}
      />
    )
  } else if (route === 'product-detail') {
    const selectedProduct = recipeProducts.find((product) => product.id === selectedProductId)
      ?? recipeProducts[0]
    page = selectedProduct ? (
      <ProductDetailPage
        key={selectedProduct.id}
        product={selectedProduct}
        catalog={materials}
        onNavigate={navigate}
        onAction={announce}
        onRefresh={reloadProducts}
        onDeactivate={async () => {
          // §3-7 : 삭제하지 않고 비활성화한다
          await deactivateProduct(selectedProduct.id)
          await reloadProducts()
          announce(`${selectedProduct.name}을(를) 목록에서 숨겼습니다.`)
          navigate('product-management')
        }}
        onUpdateImage={(imageUrl) => {
          setRecipeProducts((current) =>
            current.map((item) =>
              item.id === selectedProduct.id ? { ...item, imageUrl } : item,
            ),
          )
          // §3-4 : 낙관적 갱신 후 DB 반영
          void updateProduct(selectedProduct.id, { image_url: imageUrl }).catch(
            (error: unknown) =>
              announce(`이미지 저장 실패: ${error instanceof Error ? error.message : String(error)}`),
          )
        }}
      />
    ) : (
      <EmptyState message={displayError || '등록된 제품이 없습니다.'} />
    )
  } else if (route === 'exchange-rate-detail') {
    page = <ExchangeRateCalculatorPage products={recipeProducts} onNavigate={navigate} onAction={announce} />
  } else if (route === 'user-management') {
    page = <UserManagementPage onNavigate={navigate} onAction={announce} />
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
    <SessionProvider
      value={{ role: loginRole, userName, loginId, signOut: () => void handleSignOut() }}
    >
      {displayError && (
        <div className="app-load-error" role="alert">Supabase 연결 오류: {displayError}</div>
      )}
      {page}
      <div
        className={`toast${message ? ' is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </SessionProvider>
  )
}

export default App
