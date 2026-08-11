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
  yieldRate: number
  materialCost: number
  ingredientCount: number
  status: RecipeProductStatus
  ingredients: RecipeIngredientCost[]
  laborCost: number
  indirectCosts: IndirectCost[]
  /** 아래는 DB 연동으로 추가된 필드 (목데이터에는 없음) */
  sku?: string
  variant?: string
  specification?: string
  packageUnit?: string
  salePrice?: number
  marginRate?: number
}

export type IngredientCatalogItem = {
  id: string
  name: string
  unit: IngredientUnit
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

const poggiIngredients: RecipeIngredientCost[] = [
  { name: '배추', usage: 606_248, unit: 'kg', unitPrice: 865, cost: 601_306_148 },
  { name: '무', usage: 50_847, unit: 'kg', unitPrice: 508, cost: 25_822_662 },
  { name: '고춧가루', usage: 12_555, unit: 'kg', unitPrice: 17_870, cost: 247_064_545 },
  { name: '고춧가루(수입)', usage: 4_556, unit: 'kg', unitPrice: 8_200, cost: 27_365_260 },
  { name: '마늘', usage: 10_591, unit: 'kg', unitPrice: 7_710, cost: 25_062_410 },
  { name: '생강', usage: 1_527, unit: 'kg', unitPrice: 6_078, cost: 9_283_414 },
  { name: '멸치액젓', usage: 20_281, unit: 'kg', unitPrice: 2_180, cost: 44_401_547 },
  { name: '대파', usage: 800, unit: 'kg', unitPrice: 3_182, cost: 2_861_220 },
  { name: '조미료', usage: 708, unit: 'kg', unitPrice: 7_183, cost: 2_540_300 },
  { name: '천일염', usage: 1_432, unit: 'kg', unitPrice: 1_460, cost: 2_082_276 },
  { name: '젓갈', usage: 827, unit: 'kg', unitPrice: 868, cost: 718_803 },
]

const poggiMaterialCost = poggiIngredients.reduce((sum, item) => sum + item.cost, 0)

export const initialRecipeProducts: RecipeProduct[] = [
  {
    id: 'SKU-2024-001',
    name: '포기김치',
    description: '중간 발효 프로파일의 전통 포기김치.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Gimchi.jpg',
    yieldRate: 94.2,
    materialCost: poggiMaterialCost,
    ingredientCount: poggiIngredients.length,
    status: 'active',
    ingredients: poggiIngredients,
    laborCost: 316_320_000,
    indirectCosts: [
      { name: '전기세', amount: 79_080_000 },
      { name: '식대', amount: 49_425_000 },
      { name: '이자 비용', amount: 29_655_000 },
    ],
  },
  { id: 'SKU-2024-002', name: '맛김치', description: '소매 포장용 빠른 발효 한입 크기 조각.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Korean_cuisine-Kimchi-08.jpg', yieldRate: 91.8, materialCost: 4_500, ingredientCount: 7, status: 'review', ...recipeCosts('배추', 4_500) },
  { id: 'SKU-2024-003', name: '총각무김치', description: '아삭한 식감을 살린 총각무 기본 레시피.', imageUrl: '/products/chonggak.jpg', yieldRate: 93.5, materialCost: 7_800, ingredientCount: 7, status: 'active', ...recipeCosts('총각무', 7_800) },
  { id: 'SKU-2024-004', name: '백김치', description: '고춧가루 없이 담백하게 숙성한 배추김치.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Korean.cuisine-Baek.kimchi-02.jpg', yieldRate: 95.1, materialCost: 13_600, ingredientCount: 9, status: 'active', ...recipeCosts('배추', 13_600) },
  { id: 'SKU-2024-005', name: '깍두기', description: '급식 및 외식 채널용 대용량 무김치.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Kkakdugi%2C_radish_kimchi%2C_by_comicpie_in_Toronto.jpg', yieldRate: 92.6, materialCost: 11_400, ingredientCount: 6, status: 'review', ...recipeCosts('무', 11_400) },
  { id: 'SKU-2024-006', name: '열무김치', description: '여름철 생산용 가벼운 발효 레시피.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Yeolmu-kimchi.jpg', yieldRate: 90.9, materialCost: 7_200, ingredientCount: 8, status: 'active', ...recipeCosts('열무', 7_200) },
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
