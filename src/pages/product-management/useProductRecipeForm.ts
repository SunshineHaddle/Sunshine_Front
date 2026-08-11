import { useMemo, useState, type FormEvent } from 'react'
import { createMaterial } from '../../lib/api/products'
import type {
  IngredientCatalogItem,
  IngredientUnit,
  RecipeProduct,
} from './productManagementData'

export type SelectedIngredient = IngredientCatalogItem & { usage: number }

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
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([])

  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientPrice, setNewIngredientPrice] = useState('')
  const [newIngredientUnit, setNewIngredientUnit] = useState<IngredientUnit>('kg')

  const availableIngredients = useMemo(() => {
    const query = ingredientQuery.trim().toLocaleLowerCase('ko-KR')
    return catalog.filter((ingredient) =>
      !selectedIngredients.some((selected) => selected.id === ingredient.id)
      && (!query || ingredient.name.toLocaleLowerCase('ko-KR').includes(query)),
    )
  }, [catalog, ingredientQuery, selectedIngredients])

  const totalMaterialCost = selectedIngredients.reduce((total, ingredient) => total + ingredient.unitPrice * ingredient.usage, 0)
  const totalCost = totalMaterialCost

  const addIngredient = (ingredient: IngredientCatalogItem) => {
    setSelectedIngredients((current) => [...current, { ...ingredient, usage: 0.1 }])
    setIngredientQuery('')
  }

  /**
   * 새 재료를 DB(materials)에 먼저 등록하고, 돌려받은 uuid 로 장바구니에 담는다.
   * 예전처럼 가짜 id 를 만들어 담으면 제품 저장 시 material_id 캐스팅이 실패한다(22P02).
   */
  const addNewIngredient = async (): Promise<{ ok: boolean; message: string }> => {
    const name = newIngredientName.trim()
    const price = Number(newIngredientPrice)
    if (!name || !Number.isFinite(price) || price < 0) {
      return { ok: false, message: '재료명과 단가를 확인해 주세요.' }
    }

    try {
      const created = await createMaterial({ name, unit: newIngredientUnit, unitPrice: price })
      setSelectedIngredients((current) => [...current, { ...created, usage: 0.1 }])
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
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    newIngredientName, setNewIngredientName, newIngredientPrice, setNewIngredientPrice,
    newIngredientUnit, setNewIngredientUnit,
    totalMaterialCost, totalCost,
    addIngredient, addNewIngredient, updateUsage, updateUnitPrice, removeIngredient,
    saveRecipe,
  }
}
