export type RecipeProductStatus = 'active' | 'review'

export type IngredientUnit = 'kg' | 'g'

export type RecipeIngredientCost = {
  name: string
  usage: number
  unit: IngredientUnit
  cost: number
  unitPrice?: number
  /** materials.id (uuid). 배합 저장(§3-3, §3-6)에 필요하다 */
  materialId?: string
}

export type IndirectCost = {
  name: string
  amount: number
}

export type RecipeProduct = {
  /** DB 연동 후에는 products.id (uuid). 표시용 코드는 sku 를 쓴다 */
  id: string
  name: string
  description: string
  imageUrl?: string
  /** 수율은 더 이상 계산하지 않는다. 화면 호환을 위해 100 으로 채워진다 */
  yieldRate: number
  materialCost: number
  ingredientCount: number
  status: RecipeProductStatus
  ingredients: RecipeIngredientCost[]
  /** 노무비·간접비는 월 단위(operating_costs)로 옮겨갔다. 제품 단위로는 0 */
  laborCost: number
  indirectCosts: IndirectCost[]
  sku?: string
  variant?: string
  specification?: string
  packageUnit?: string
  salePrice?: number
  marginRate?: number
  /**
   * 포장 1개의 무게(kg). 원가는 kg 단위, 판매가는 포장 단위라 환산에 쓴다.
   * 비어 있으면 마감 계산이 1kg 으로 간주해 마진율이 과대 계상된다.
   */
  unitWeightKg?: number
}

export type IngredientCatalogItem = {
  id: string
  name: string
  unit: IngredientUnit
  unitPrice: number
}
