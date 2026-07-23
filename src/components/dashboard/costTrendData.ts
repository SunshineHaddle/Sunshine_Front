export type CostPeriod = 'monthly' | 'annual'

export type CostPoint = {
  label: string
  managementTotalCost: number
  manufacturingCost: number
}

const monthlyCosts: CostPoint[] = [
  { label: '1월', managementTotalCost: 78, manufacturingCost: 61 },
  { label: '2월', managementTotalCost: 82, manufacturingCost: 64 },
  { label: '3월', managementTotalCost: 79, manufacturingCost: 62 },
  { label: '4월', managementTotalCost: 88, manufacturingCost: 69 },
  { label: '5월', managementTotalCost: 91, manufacturingCost: 72 },
  { label: '6월', managementTotalCost: 86, manufacturingCost: 67 },
  { label: '7월', managementTotalCost: 90, manufacturingCost: 70 },
  { label: '8월', managementTotalCost: 94, manufacturingCost: 73 },
  { label: '9월', managementTotalCost: 89, manufacturingCost: 68 },
  { label: '10월', managementTotalCost: 97, manufacturingCost: 76 },
  { label: '11월', managementTotalCost: 93, manufacturingCost: 72 },
  { label: '12월', managementTotalCost: 99, manufacturingCost: 77 },
]

const annualCosts: CostPoint[] = [
  { label: '2022', managementTotalCost: 912, manufacturingCost: 706 },
  { label: '2023', managementTotalCost: 978, manufacturingCost: 751 },
  { label: '2024', managementTotalCost: 1034, manufacturingCost: 796 },
  { label: '2025', managementTotalCost: 1088, manufacturingCost: 842 },
  { label: '2026', managementTotalCost: 1066, manufacturingCost: 821 },
]

export const costChartBounds = {
  width: 720,
  height: 255,
  left: 48,
  right: 574,
  top: 18,
  bottom: 218,
}

export function getCostTrend(period: CostPeriod) {
  return period === 'monthly' ? monthlyCosts : annualCosts
}
