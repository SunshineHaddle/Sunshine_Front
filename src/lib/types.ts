/**
 * DB 행 타입. supabase/schema.sql 의 스키마와 1:1로 대응한다.
 *
 * 스키마를 바꾸면 아래 명령으로 다시 생성하는 것을 권장한다.
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type UserRole = 'admin' | 'entry' | 'reviewer'
export type MaterialUnit = 'kg' | 'g'
export type ProductStatus = 'active' | 'review'
export type PeriodStatus = 'draft' | 'submitted' | 'confirmed'
export type CostCategory = 'labor' | 'utility' | 'indirect' | 'finance' | 'other'
export type AllocationType = 'percent' | 'amount'
export type ProfitStatus = 'normal' | 'watch' | 'risk'
export type CostSource = 'standard' | 'actual'

export type MaterialRow = {
  id: string
  code: string
  name: string
  unit: MaterialUnit
  unit_price: number
  is_active: boolean
}

export type ProductRow = {
  id: string
  sku: string
  name: string
  variant: string | null
  description: string | null
  image_url: string | null
  specification: string | null
  package_unit: string
  yield_rate: number
  sale_price: number
  margin_rate: number
  status: ProductStatus
  is_active: boolean
}

export type RecipeItemRow = {
  id: string
  product_id: string
  material_id: string
  usage_qty: number
  unit: MaterialUnit
  unit_price: number
  /** generated 컬럼. 읽기 전용 */
  amount: number
  sort_order: number
}

export type CostPeriodRow = {
  id: string
  period: string
  status: PeriodStatus
  submitted_by: string | null
  submitted_at: string | null
}

export type ProductionRecordRow = {
  id: string
  period_id: string
  product_id: string
  production_qty: number
  defect_qty: number
  note: string | null
}

export type MaterialUsageRow = {
  id: string
  period_id: string
  product_id: string
  material_id: string
  usage_qty: number
  unit: MaterialUnit
  unit_price: number
  /** generated 컬럼. 읽기 전용 */
  amount: number
  source: string
}

export type OperatingCostRow = {
  id: string
  period_id: string
  name: string
  category: CostCategory
  allocation: AllocationType
  total_amount: number
  sort_order: number
}

export type CostAllocationRow = {
  id: string
  operating_cost_id: string
  product_id: string
  share_percent: number | null
  amount: number
}

export type CostSummaryRow = {
  id: string
  period_id: string
  product_id: string
  production_qty: number
  material_cost: number
  labor_cost: number
  utility_cost: number
  /** generated 컬럼. 읽기 전용 */
  manufacturing_cost: number
  /** generated 컬럼. 읽기 전용 */
  total_cost: number
  unit_cost: number
  sale_price: number
  margin_rate: number
  cost_rate: number
  yield_rate: number | null
  defect_rate: number | null
  status: ProfitStatus
  cost_source: CostSource
}

export type FileUploadRow = {
  id: string
  period_id: string | null
  bucket: string
  storage_path: string
  original_name: string
  file_name: string | null
  description: string | null
  file_type: string | null
  size: number | null
  row_count: number | null
  uploaded_by: string | null
  uploaded_at: string
}

export type ProfileRow = {
  id: string
  login_id: string
  name: string
  role: UserRole
  is_active: boolean
  last_active_at: string | null
}

/** numeric 컬럼이 문자열로 올 수 있어 방어적으로 변환한다. */
export const num = (v: unknown) => Number(v ?? 0) || 0

/** 'YYYY-MM' → 'YYYY-MM-01' (F-10) */
export const toPeriodDate = (month: string) => `${month}-01`

/** 'YYYY-MM-01' → 'YYYY-MM' (F-10) */
export const toMonth = (period: string) => period.slice(0, 7)
