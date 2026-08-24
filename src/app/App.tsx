import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import '../styles/dashboard.css'
import '../styles/workflow.css'
import '../styles/product-management.css'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import {
  hashForRoute,
  resolveRoute,
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
  countProductReferences,
  deactivateProduct,
  createProductWithRecipe,
  findLockedPeriods,
  deleteProduct,
  fetchHiddenProducts,
  fetchMaterials,
  fetchProducts,
  restoreProduct,
  updateProduct,
} from '../lib/api/products'
import { ensurePeriod } from '../lib/api/periods'
import { fetchRecipeCostSummary, type RecipeCostSummary } from '../lib/api/results'
import type { CostPeriodRow } from '../lib/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchMyProfile, getSessionUserId, onSessionLost, signOut, toLoginRole } from '../lib/api/auth'
import { describeDbError } from '../lib/api/errors'
import { SessionProvider } from '../lib/session'
import {
  isEntrySavedBeforeSession,
  isEntrySavedThisSession,
  refreshEntrySavedSnapshot,
} from '../utils/entrySaved'

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
  /** §3-7 : 숨긴 제품. 되돌리기 목록에 쓴다 */
  const [hiddenProducts, setHiddenProducts] = useState<{ id: string; sku: string; name: string }[]>([])
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
      const [products, recipeCosts, hidden] = await Promise.all([
        fetchProducts(),
        // §9-3 : 재료비는 DB 집계값을 신뢰한다. 클라이언트 합산과 어긋나면 이쪽이 맞다.
        // 실패해도 제품 목록은 살려야 하므로 빈 배열로 흘린다 (타입은 명시해야 유니온이 안 생긴다)
        fetchRecipeCostSummary().catch((): RecipeCostSummary[] => []),
        fetchHiddenProducts().catch((): { id: string; sku: string; name: string }[] => []),
      ])
      setHiddenProducts(hidden)
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

  /**
   * §3-7 제품을 완전히 삭제한다. 남아 있는 자료를 먼저 알리고 확인받는다.
   * 상세 페이지와 숨긴 제품 목록 양쪽에서 쓴다.
   * @returns 실제로 지웠으면 true
   */
  const confirmAndDeleteProduct = useCallback(async (target: { id: string; name: string }) => {
    // 마감된 달의 자료는 지울 수 없다. 확인창을 띄우기 전에 먼저 걸러낸다 —
    // 눌러본 뒤에야 막힌 걸 알게 하지 않는다
    const locked = await findLockedPeriods(target.id)
    if (locked.length > 0) {
      const months = locked
        .map((p) => `${p.slice(0, 4)}년 ${Number(p.slice(5, 7))}월`)
        .join(', ')
      window.alert(
        [
          `${target.name}은(는) 마감된 달의 자료를 가지고 있어 삭제할 수 없습니다.`,
          months,
          '',
          '데이터 입력 1단계에서 해당 월의 마감을 취소한 뒤 다시 시도해주세요.',
          '',
          '지우지 않고 목록에서만 치우려면 "목록에서 숨기기" 를 쓰세요.',
        ].join('\n'),
      )
      return false
    }

    const refs = await countProductReferences(target.id)

    const detail = [
      refs.usages && `투입내역 ${refs.usages}건`,
      refs.production && `생산량 ${refs.production}건`,
      refs.summaries && `원가 결과 ${refs.summaries}건`,
      refs.allocations && `운영비 배분 ${refs.allocations}건`,
    ].filter(Boolean).join(' · ')

    const ok = window.confirm(
      refs.total === 0
        ? `${target.name}을(를) 완전히 삭제할까요?\n되돌릴 수 없습니다.`
        : [
            `${target.name}에는 과거 자료가 남아 있습니다.`,
            detail,
            '',
            '삭제하면 그 달 원가 결과도 함께 사라지며 되돌릴 수 없습니다.',
            '계속할까요?',
          ].join('\n'),
    )
    if (!ok) return false

    await deleteProduct(target.id)
    return true
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
    // 주소창에 직접 치거나 뒤로가기로 들어와도 같은 판정을 거친다.
    // 예전에는 여기서 routeFromHash 결과를 그대로 써서, 실무자가 #dashboard 를
    // 입력하면 route 상태가 dashboard 가 됐다 (화면 분기가 가려줬을 뿐이다).
    const handleHashChange = () => {
      if (!loginRole) return
      const requested = routeFromHash(window.location.hash)
      const allowed = resolveRoute(requested, loginRole)
      setRoute(allowed)
      // 막힌 화면이면 주소창도 되돌린다. 안 그러면 URL 과 화면이 어긋난 채 남는다
      if (allowed !== requested) {
        window.history.replaceState(null, '', hashForRoute(allowed))
      }
    }
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#dashboard')
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.clearTimeout(messageTimer.current)
    }
  }, [loginRole])

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

  /**
   * 화면 하단 안내 문구. 자식 이펙트의 의존성으로 들어가므로 참조가 고정돼야 한다 —
   * 매 렌더마다 새로 만들면 그 이펙트가 계속 다시 돌아 조회가 반복된다.
   */
  const announce = useCallback((nextMessage: string) => {
    window.clearTimeout(messageTimer.current)
    setMessage(nextMessage)
    messageTimer.current = window.setTimeout(() => setMessage(''), 2600)
  }, [])

  /** 로그인 화면으로 되돌린다. 로그아웃과 세션 만료가 같은 처리를 쓴다 */
  const resetToLogin = useCallback(() => {
    // 로그아웃을 새 세션 경계로 삼아, 그동안 저장한 회차는 재로그인 후 빈 폼으로 시작하게 한다
    refreshEntrySavedSnapshot()
    setLoginRole(null)
    setUserName('')
    setLoginId('')
    setRecipeProducts([])
    setPeriod(null)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    resetToLogin()
  }

  /**
   * 세션이 끊기면(다른 기기 로그아웃·토큰 갱신 실패) 로그인 화면으로 돌린다.
   *
   * 이게 없으면 앱이 계속 조회하는데, RLS 는 빈 배열을 주므로 화면이
   * "데이터가 없다"처럼 보인다 — 원인을 알 길이 없다.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    return onSessionLost(() => {
      // 사용자가 직접 누른 로그아웃은 handleSignOut 이 이미 정리했다.
      // 그때는 loginRole 이 null 이라 이 안내가 뜨지 않는다.
      setLoginRole((current) => {
        if (current) announce('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return current
      })
      resetToLogin()
    })
  }, [announce, resetToLogin])


  const navigate = (requestedRoute: AppRoute) => {
    // worker 는 3단계로 못 간다. 예전엔 조용히 무시했는데, 2단계에서 저장하면
    // 그 이동이 3단계 시도라 화면이 멈춘 것처럼 보였다. 1단계로 돌려보낸다 —
    // 방금 저장한 값이 채워진 채로 열린다 (freshEntry 판정 참고).
    const nextRoute = loginRole ? resolveRoute(requestedRoute, loginRole) : requestedRoute
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
    // 빈 폼으로 시작하는 조건: 이번 세션이 시작되기 전에 이미 저장 완료한 회차.
    // worker/admin 모두 같은 규칙 — 재접속(로그아웃·새로고침) 하면 빈 폼.
    //
    // 단, worker 가 이번 세션에 저장 버튼을 눌렀다면 그 회차는 빈 폼으로 돌리지 않는다.
    // 2단계에서 저장하면 1단계로 돌아오는데(navigate 참고), 거기서 방금 넣은 값이
    // 사라져 보이면 안 된다. admin 은 저장 후 3단계로 가므로 예전 그대로 둔다.
    freshEntry:
      isEntrySavedBeforeSession(period?.id ?? null)
      && !(loginRole === 'worker' && isEntrySavedThisSession(period?.id ?? null)),
    onMonthChange: setMonth,
    onNavigate: navigate,
    onAction: announce,
    // 1단계에서 수불자료 시트명으로 제품을 만들면 목록을 다시 읽어야 한다
    onProductsChanged: reloadProducts,
  }

  // 1단계는 worker·admin 이 같은 화면을 본다 — 월별 마감 배지와 마감 버튼까지 동일.
  // (3단계 접근만 worker 에게 막혀 있다)
  const rawMaterialEntryPage = (
    <RawMaterialEntryPage
      {...entryProps}
      isLocked={period?.status === 'confirmed'}
      onPeriodChanged={() => void refreshPeriod()}
    />
  )

  let page: ReactNode

  if (loginRole === 'worker') {
    // 해시를 직접 고쳐 허용되지 않은 route 로 들어와도 1단계로 떨어뜨린다
    page =
      route === 'data-entry-2' ? (
        <OperatingCostEntryPage {...entryProps} isLocked={period?.status === 'confirmed'} />
      ) : (
        rawMaterialEntryPage
      )
  } else if (route === 'data-entry-1') {
    page = rawMaterialEntryPage
  } else if (route === 'data-entry-2') {
    page = <OperatingCostEntryPage {...entryProps} isLocked={period?.status === 'confirmed'} />
  } else if (route === 'data-entry-3') {
    page = (
      <ProductionResultPage
        month={month}
        periodId={period?.id ?? null}
        isLocked={period?.status === 'confirmed'}
        onNavigate={navigate}
        onAction={announce}
        // 마감 후 1단계로 넘어가기 전에 상태 갱신이 끝나야 해서 Promise 를 넘긴다
        onPeriodChanged={() => refreshPeriod()}
      />
    )
  } else if (route === 'product-management') {
    page = (
      <ProductManagementPage
        products={recipeProducts}
        hiddenProducts={hiddenProducts}
        onDeleteProduct={async (productId) => {
          const target = hiddenProducts.find((p) => p.id === productId)
          if (!target) return
          try {
            if (await confirmAndDeleteProduct(target)) {
              await reloadProducts()
              announce(`${target.name}을(를) 완전히 삭제했습니다.`)
            }
          } catch (error) {
            announce(`삭제 실패: ${describeDbError(error)}`)
          }
        }}
        onRestoreProduct={async (productId) => {
          const target = hiddenProducts.find((p) => p.id === productId)
          try {
            await restoreProduct(productId)
            await reloadProducts()
            announce(`${target?.name ?? '제품'}을(를) 목록에 되돌렸습니다.`)
          } catch (error) {
            announce(`되돌리기 실패: ${error instanceof Error ? error.message : String(error)}`)
          }
        }}
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
          // sku 는 API 가 DB 최대 번호를 보고 정한다.
          // 화면의 제품 개수로 만들면 숨긴 제품과 번호가 겹친다
          void createProductWithRecipe({
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
            .then(async (newProductId) => {
              // 사진은 RPC 가 받지 않는다. 제품이 생긴 뒤 따로 붙인다 —
              // 예전에는 이 단계가 없어서, 생성 화면에서 고른 사진이
              // 저장에서 조용히 버려졌다 (상세에서 다시 넣어야 보였다).
              if (product.imageUrl) {
                await updateProduct(newProductId, { image_url: product.imageUrl })
              }
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
          // §3-7 : 숨기지 않고 바로 지운다. 무엇이 함께 사라지는지 확인창에서 알린다
          if (await confirmAndDeleteProduct(selectedProduct)) {
            await reloadProducts()
            announce(`${selectedProduct.name}을(를) 삭제했습니다.`)
            navigate('product-management')
          }
        }}
        onHide={async () => {
          // 지우는 게 아니라 is_active 만 내린다. 과거 원가는 그대로 남는다
          const ok = window.confirm(
            [
              `${selectedProduct.name}을(를) 목록에서 숨길까요?`,
              '',
              '과거 원가 기록은 그대로 남고, 제품 관리 아래 "숨긴 제품"에서 되돌릴 수 있습니다.',
              '1단계 생산량 입력과 대시보드에서는 보이지 않게 됩니다.',
            ].join('\n'),
          )
          if (!ok) return
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
