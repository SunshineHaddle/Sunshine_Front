import { DashboardHeader } from '../../components/dashboard/DashboardChrome'
import { ProductCostTrendCarousel } from '../../components/dashboard/DashboardSummaryCharts'
import { ProductProfitabilityTable } from '../../components/dashboard/ProductProfitabilityTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { products } from './dashboardData'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'

type DashboardPageProps = {
  isWorker?: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  recipeProducts: RecipeProduct[]
  onSelectRecipe: (productId: string) => void
}

export function DashboardPage({ isWorker = false, onNavigate, recipeProducts, onSelectRecipe }: DashboardPageProps) {
  return (
    <div className={`dashboard-app${isWorker ? ' dashboard-app--worker' : ''}`}>
      <Sidebar activeRoute="dashboard" hidden={isWorker} onNavigate={onNavigate} />

      <div className="main-shell">
        <main className="dashboard-content">
          <DashboardHeader />

          <div className="summary-grid">
            <ProductCostTrendCarousel products={recipeProducts} onOpen={onSelectRecipe} />
          </div>

          <ProductProfitabilityTable items={products} />
        </main>
      </div>
    </div>
  )
}
