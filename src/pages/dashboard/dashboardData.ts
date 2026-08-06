import type { IconName } from '../../components/common/Icon'
import type { AppRoute } from '../../data/navigation'

export type ProductStatus = 'normal' | 'watch' | 'risk'

export type ProductProfitabilityItem = {
  id: string
  name: string
  variant?: string
  specification: string
  packageUnit: string
  productionQuantity: number
  manufacturingCost: number
  totalCost: number
  salePrice: number
  marginRate: number
  yieldRate: number
  defectRate: number
  status: ProductStatus
}

export const products: ProductProfitabilityItem[] = [
  {
    id: 'PRD-001',
    name: '포기김치',
    variant: '정품',
    specification: '5kg',
    packageUnit: 'PCK',
    productionQuantity: 24_500,
    manufacturingCost: 18_200,
    totalCost: 21_500,
    salePrice: 28_900,
    marginRate: 25.6,
    yieldRate: 98.2,
    defectRate: 1.8,
    status: 'normal',
  },
  {
    id: 'PRD-002',
    name: '총각무김치',
    specification: '2kg',
    packageUnit: 'PCK',
    productionQuantity: 31_200,
    manufacturingCost: 7_800,
    totalCost: 9_100,
    salePrice: 12_600,
    marginRate: 27.8,
    yieldRate: 98.6,
    defectRate: 1.4,
    status: 'normal',
  },
  {
    id: 'PRD-003',
    name: '맛김치',
    specification: '1kg',
    packageUnit: 'PCK',
    productionQuantity: 42_000,
    manufacturingCost: 4_500,
    totalCost: 5_200,
    salePrice: 6_500,
    marginRate: 20,
    yieldRate: 97.5,
    defectRate: 2.5,
    status: 'normal',
  },
  {
    id: 'PRD-004',
    name: '깍두기',
    variant: 'B2B',
    specification: '3kg',
    packageUnit: 'BOX',
    productionQuantity: 12_800,
    manufacturingCost: 11_400,
    totalCost: 13_800,
    salePrice: 13_000,
    marginRate: -5.8,
    yieldRate: 94.2,
    defectRate: 5.8,
    status: 'risk',
  },
  {
    id: 'PRD-005',
    name: '동치미',
    specification: '2kg',
    packageUnit: 'PCK',
    productionQuantity: 18_500,
    manufacturingCost: 8_900,
    totalCost: 10_400,
    salePrice: 14_200,
    marginRate: 26.7,
    yieldRate: 98.8,
    defectRate: 1.2,
    status: 'normal',
  },
  {
    id: 'PRD-006',
    name: '열무김치',
    specification: '500g',
    packageUnit: 'PCK',
    productionQuantity: 9_200,
    manufacturingCost: 7_200,
    totalCost: 8_800,
    salePrice: 11_500,
    marginRate: 23.4,
    yieldRate: 96.1,
    defectRate: 3.9,
    status: 'watch',
  },
  {
    id: 'PRD-007',
    name: '백김치',
    variant: '한맛용',
    specification: '3kg',
    packageUnit: 'PCK',
    productionQuantity: 21_400,
    manufacturingCost: 13_600,
    totalCost: 16_100,
    salePrice: 20_900,
    marginRate: 23,
    yieldRate: 97.9,
    defectRate: 2.1,
    status: 'normal',
  },
  {
    id: 'PRD-008',
    name: '갓파기',
    variant: '소포장',
    specification: '1kg',
    packageUnit: 'PCK',
    productionQuantity: 16_300,
    manufacturingCost: 6_700,
    totalCost: 8_200,
    salePrice: 10_500,
    marginRate: 21.9,
    yieldRate: 96.8,
    defectRate: 3.2,
    status: 'watch',
  },
  {
    id: 'PRD-009',
    name: '파김치',
    specification: '500g',
    packageUnit: 'PCK',
    productionQuantity: 27_600,
    manufacturingCost: 3_600,
    totalCost: 4_300,
    salePrice: 5_900,
    marginRate: 27.1,
    yieldRate: 98.4,
    defectRate: 1.6,
    status: 'normal',
  },
  {
    id: 'PRD-010',
    name: '고들빼기',
    specification: '1kg',
    packageUnit: 'PCK',
    productionQuantity: 11_700,
    manufacturingCost: 5_100,
    totalCost: 6_400,
    salePrice: 7_900,
    marginRate: 19,
    yieldRate: 95.7,
    defectRate: 4.3,
    status: 'watch',
  },
  {
    id: 'PRD-011',
    name: '나박김치',
    specification: '2kg',
    packageUnit: 'PCK',
    productionQuantity: 14_900,
    manufacturingCost: 8_100,
    totalCost: 9_700,
    salePrice: 12_300,
    marginRate: 21.1,
    yieldRate: 97.2,
    defectRate: 2.8,
    status: 'normal',
  },
  {
    id: 'PRD-012',
    name: '오이소박이',
    specification: '1kg',
    packageUnit: 'PCK',
    productionQuantity: 8_600,
    manufacturingCost: 6_900,
    totalCost: 8_500,
    salePrice: 8_200,
    marginRate: -3.7,
    yieldRate: 93.9,
    defectRate: 6.1,
    status: 'risk',
  },
]

export type InsightTone = 'blue' | 'brand' | 'amber'

export type DashboardInsight = {
  id: 'exchange-rate' | 'cost-trend' | 'defect-status'
  title: string
  description: string
  value: string
  unit: string
  change: string
  changeLabel: string
  icon: IconName
  tone: InsightTone
  route: Extract<
    AppRoute,
    'exchange-rate-detail' | 'cost-trend-detail' | 'defect-status-detail'
  >
  chartLabel: string
  chartPoints: number[]
}

export const dashboardInsights: DashboardInsight[] = [
  {
    id: 'exchange-rate',
    title: '환율 정보',
    description: 'USD/KRW 기준 환율',
    value: '1,386.40',
    unit: '원',
    change: '+0.18%',
    changeLabel: '전일 대비',
    icon: 'exchange',
    tone: 'blue',
    route: 'exchange-rate-detail',
    chartLabel: '최근 7일 환율 추이',
    chartPoints: [32, 30, 34, 29, 25, 27, 22],
  },
  {
    id: 'cost-trend',
    title: '원가 변동 추이',
    description: '이번 달 누적 제조 원가',
    value: '842',
    unit: '백만원',
    change: '-2.4%',
    changeLabel: '전월 대비',
    icon: 'trend',
    tone: 'brand',
    route: 'cost-trend-detail',
    chartLabel: '최근 7개월 제조 원가 추이',
    chartPoints: [18, 23, 20, 28, 26, 33, 29],
  },
]

export const dashboardInsightByRoute = Object.fromEntries(
  dashboardInsights.map((insight) => [insight.route, insight]),
) as Record<DashboardInsight['route'], DashboardInsight>
