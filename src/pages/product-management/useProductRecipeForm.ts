import { useMemo, useState, type FormEvent } from 'react'
import { createMaterial } from '../../lib/api/products'
import type {
  IngredientCatalogItem,
  IngredientUnit,
  RecipeProduct,
} from './productManagementData'
import { DEFAULT_KIMCHI_MATERIALS, materialKey } from './defaultMaterials'

export type SelectedIngredient = IngredientCatalogItem & { usage: number }

/**
 * 화면의 재료 후보 한 줄.
 * isSuggestion 이면 아직 DB 에 없는 기본 재료라, 고르는 순간 등록부터 한다.
 */
export type IngredientOption = IngredientCatalogItem & { isSuggestion?: boolean }

type UseProductRecipeFormOptions = {
  nextProductNumber: number
  onCreate: (product: RecipeProduct) => void
  /** DB에서 불러온 원재료 목록(§2-1) */
  catalog?: IngredientCatalogItem[]
}

export function useProductRecipeForm({
  nextProductNumber,
  onCreate,
  catalog = [],
}: UseProductRecipeFormOptions) {
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([])

  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientPrice, setNewIngredientPrice] = useState('')
  const [newIngredientUnit, setNewIngredientUnit] = useState<IngredientUnit>('kg')

  /**
   * DB 카탈로그 + 아직 등록되지 않은 기본 김치 재료.
   * materials 가 비어 있어도 바로 고를 수 있어야 한다는 요구가 있어 후자를 덧붙인다.
   */
  const availableIngredients = useMemo<IngredientOption[]>(() => {
    const query = ingredientQuery.trim().toLocaleLowerCase('ko-KR')
    const takenKeys = new Set(selectedIngredients.map((s) => materialKey(s.name)))
    const catalogKeys = new Set(catalog.map((c) => materialKey(c.name)))

    const matches = (name: string) =>
      !query || name.toLocaleLowerCase('ko-KR').includes(query)

    const fromCatalog: IngredientOption[] = catalog.filter((ingredient) =>
      !selectedIngredients.some((selected) => selected.id === ingredient.id)
      && matches(ingredient.name),
    )

    const suggestions: IngredientOption[] = DEFAULT_KIMCHI_MATERIALS
      .filter((item) =>
        !catalogKeys.has(materialKey(item.name))
        && !takenKeys.has(materialKey(item.name))
        && matches(item.name),
      )
      .map((item) => ({
        // 아직 DB 행이 없으므로 임시 키. 담을 때 실제 uuid 로 교체된다
        id: `suggestion:${item.name}`,
        name: item.name,
        unit: item.unit,
        unitPrice: 0,
        isSuggestion: true,
      }))

    return [...fromCatalog, ...suggestions]
  }, [catalog, ingredientQuery, selectedIngredients])

  const totalMaterialCost = selectedIngredients.reduce((total, ingredient) => total + ingredient.unitPrice * ingredient.usage, 0)
  const totalCost = totalMaterialCost

  /** 담을 때의 기본 수량. 대부분 kg 단위로 세므로 1 에서 시작한다 */
  const DEFAULT_USAGE = 1

  /**
   * 후보를 장바구니에 담는다.
   * 기본 재료 제안은 DB 행이 없으므로 먼저 materials 에 등록하고 uuid 를 받아온다 —
   * 가짜 id 로 담으면 제품 저장 시 material_id 캐스팅이 실패한다(22P02).
   */
  const addIngredient = async (
    ingredient: IngredientOption,
  ): Promise<{ ok: boolean; message: string }> => {
    if (!ingredient.isSuggestion) {
      setSelectedIngredients((current) => [...current, { ...ingredient, usage: DEFAULT_USAGE }])
      setIngredientQuery('')
      return { ok: true, message: '' }
    }

    try {
      const created = await createMaterial({
        name: ingredient.name,
        unit: ingredient.unit,
        unitPrice: 0,
      })
      setSelectedIngredients((current) => [...current, { ...created, usage: DEFAULT_USAGE }])
      setIngredientQuery('')
      return { ok: true, message: `${ingredient.name}을(를) 원재료로 등록하고 담았습니다.` }
    } catch (error) {
      return {
        ok: false,
        message: `재료 등록 실패: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * 새 재료를 DB(materials)에 먼저 등록하고, 돌려받은 uuid 로 장바구니에 담는다.
   * 예전처럼 가짜 id 를 만들어 담으면 제품 저장 시 material_id 캐스팅이 실패한다(22P02).
   */
  const addNewIngredient = async (): Promise<{ ok: boolean; message: string }> => {
    const name = newIngredientName.trim()
    if (!name) {
      return { ok: false, message: '재료명을 입력해 주세요.' }
    }
    // 단가·단위는 선택 입력이다. 실제 단가는 수불자료(1단계)에서 들어오므로
    // 여기서는 비워둔 채 0원·kg 으로 등록하고 나중에 덮어쓴다.
    const price = Number(newIngredientPrice || 0)
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, message: '단가는 0 이상의 숫자로 입력해 주세요.' }
    }

    try {
      const created = await createMaterial({ name, unit: newIngredientUnit, unitPrice: price })
      setSelectedIngredients((current) => [...current, { ...created, usage: DEFAULT_USAGE }])
      setNewIngredientName('')
      setNewIngredientPrice('')
      setNewIngredientUnit('kg')
      return { ok: true, message: `${name}을(를) 원재료로 등록하고 담았습니다.` }
    } catch (error) {
      return {
        ok: false,
        message: `재료 등록 실패: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  const updateUsage = (id: string, usage: number) => {
    setSelectedIngredients((current) => current.map((ingredient) =>
      ingredient.id === id ? { ...ingredient, usage: Math.max(0, usage) } : ingredient,
    ))
  }

  const updateUnitPrice = (id: string, unitPrice: number) => {
    setSelectedIngredients((current) => current.map((ingredient) =>
      ingredient.id === id ? { ...ingredient, unitPrice: Math.max(0, unitPrice) } : ingredient,
    ))
  }

  const removeIngredient = (id: string) => {
    setSelectedIngredients((current) => current.filter((item) => item.id !== id))
  }

  const saveRecipe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!productName.trim() || selectedIngredients.length === 0) return

    onCreate({
      id: `SKU-${new Date().getFullYear()}-${String(nextProductNumber).padStart(3, '0')}`,
      name: productName.trim(),
      description: description.trim() || `${selectedIngredients.length}개 재료로 구성된 신규 레시피.`,
      imageUrl: imageUrl || undefined,
      yieldRate: 100,
      materialCost: totalMaterialCost,
      ingredientCount: selectedIngredients.length,
      status: 'review',
      ingredients: selectedIngredients.map((ingredient) => ({
        // DB 저장(§3-3)에 필요하다. 카탈로그 항목의 id 가 곧 materials.id
        materialId: ingredient.id,
        name: ingredient.name,
        usage: ingredient.usage,
        unit: ingredient.unit,
        unitPrice: ingredient.unitPrice,
        cost: ingredient.unitPrice * ingredient.usage,
      })),
      laborCost: 0,
      indirectCosts: [],
    })
  }

  return {
    productName, setProductName, description, setDescription,
    imageUrl, setImageUrl,
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    newIngredientName, setNewIngredientName, newIngredientPrice, setNewIngredientPrice,
    newIngredientUnit, setNewIngredientUnit,
    totalMaterialCost, totalCost,
    addIngredient, addNewIngredient, updateUsage, updateUnitPrice, removeIngredient,
    saveRecipe,
  }
}
