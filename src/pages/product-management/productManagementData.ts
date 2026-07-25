export type RecipeProductStatus = 'active' | 'review'

export type RecipeIngredientCost = {
  name: string
  usage: number
  unit: 'kg'
  cost: number
}

export type IndirectCost = {
  name: string
  amount: number
}

export type RecipeProduct = {
  id: string
  name: string
  description: string
  yieldRate: number
  materialCost: number
  ingredientCount: number
  status: RecipeProductStatus
  ingredients: RecipeIngredientCost[]
  laborCost: number
  indirectCosts: IndirectCost[]
}

export type IngredientCatalogItem = {
  id: string
  name: string
  unit: 'kg'
  unitPrice: number
}

const recipeCosts = (primaryIngredient: string, materialCost: number) => {
  const primaryCost = Math.round(materialCost * 0.55)
  const seasoningCost = Math.round(materialCost * 0.27)

  return {
    ingredients: [
      { name: primaryIngredient, usage: 5, unit: 'kg' as const, cost: primaryCost },
      { name: '고춧가루', usage: 0.35, unit: 'kg' as const, cost: seasoningCost },
      { name: '마늘 및 양념', usage: 0.5, unit: 'kg' as const, cost: materialCost - primaryCost - seasoningCost },
    ],
    laborCost: Math.round(materialCost * 0.32),
    indirectCosts: [
      { name: '전기세', amount: Math.round(materialCost * 0.08) },
      { name: '식대', amount: Math.round(materialCost * 0.05) },
      { name: '이자 비용', amount: Math.round(materialCost * 0.03) },
    ],
  }
}

export const initialRecipeProducts: RecipeProduct[] = [
  { id: 'SKU-2024-001', name: '포기김치', description: '중간 발효 프로파일의 전통 포기김치.', yieldRate: 94.2, materialCost: 18_200, ingredientCount: 8, status: 'active', ...recipeCosts('배추', 18_200) },
  { id: 'SKU-2024-002', name: '맛김치', description: '소매 포장용 빠른 발효 한입 크기 조각.', yieldRate: 91.8, materialCost: 4_500, ingredientCount: 7, status: 'review', ...recipeCosts('배추', 4_500) },
  { id: 'SKU-2024-003', name: '총각무김치', description: '아삭한 식감을 살린 총각무 기본 레시피.', yieldRate: 93.5, materialCost: 7_800, ingredientCount: 7, status: 'active', ...recipeCosts('총각무', 7_800) },
  { id: 'SKU-2024-004', name: '백김치', description: '고춧가루 없이 담백하게 숙성한 배추김치.', yieldRate: 95.1, materialCost: 13_600, ingredientCount: 9, status: 'active', ...recipeCosts('배추', 13_600) },
  { id: 'SKU-2024-005', name: '깍두기', description: '급식 및 외식 채널용 대용량 무김치.', yieldRate: 92.6, materialCost: 11_400, ingredientCount: 6, status: 'review', ...recipeCosts('무', 11_400) },
  { id: 'SKU-2024-006', name: '열무김치', description: '여름철 생산용 가벼운 발효 레시피.', yieldRate: 90.9, materialCost: 7_200, ingredientCount: 8, status: 'active', ...recipeCosts('열무', 7_200) },
]

export const RECIPE_PRODUCTS_STORAGE_KEY = 'sunshine.recipe-products.v1'

export const ingredientCatalog: IngredientCatalogItem[] = [
  { id: 'MAT-001', name: '배추', unit: 'kg', unitPrice: 1_800 },
  { id: 'MAT-002', name: '무', unit: 'kg', unitPrice: 1_500 },
  { id: 'MAT-003', name: '고춧가루', unit: 'kg', unitPrice: 12_800 },
  { id: 'MAT-004', name: '다진 마늘', unit: 'kg', unitPrice: 8_200 },
  { id: 'MAT-005', name: '멸치액젓', unit: 'kg', unitPrice: 5_400 },
  { id: 'MAT-006', name: '새우젓', unit: 'kg', unitPrice: 8_900 },
  { id: 'MAT-007', name: '천일염', unit: 'kg', unitPrice: 1_200 },
  { id: 'MAT-008', name: '대파', unit: 'kg', unitPrice: 4_300 },
  { id: 'MAT-009', name: '찹쌀풀', unit: 'kg', unitPrice: 2_600 },
  { id: 'MAT-010', name: '생강', unit: 'kg', unitPrice: 9_500 },
]
