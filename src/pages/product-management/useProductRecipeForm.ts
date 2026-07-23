import { useMemo, useState, type FormEvent } from 'react'
import {
  ingredientCatalog,
  type IngredientCatalogItem,
  type RecipeProduct,
} from './productManagementData'

export type SelectedIngredient = IngredientCatalogItem & { usage: number }
export type IndirectCosts = { electricity: number; meal: number; interest: number }

type UseProductRecipeFormOptions = {
  nextProductNumber: number
  onCreate: (product: RecipeProduct) => void
}

export function useProductRecipeForm({ nextProductNumber, onCreate }: UseProductRecipeFormOptions) {
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([])
  const [hourlyWage, setHourlyWage] = useState(12_000)
  const [laborHours, setLaborHours] = useState(1.5)
  const [indirectCosts, setIndirectCosts] = useState<IndirectCosts>({ electricity: 1_200, meal: 1_000, interest: 500 })

  const availableIngredients = useMemo(() => {
    const query = ingredientQuery.trim().toLocaleLowerCase('ko-KR')
    return ingredientCatalog.filter((ingredient) =>
      !selectedIngredients.some((selected) => selected.id === ingredient.id)
      && (!query || ingredient.name.toLocaleLowerCase('ko-KR').includes(query)),
    )
  }, [ingredientQuery, selectedIngredients])

  const totalMaterialCost = selectedIngredients.reduce((total, ingredient) => total + ingredient.unitPrice * ingredient.usage, 0)
  const laborCost = hourlyWage * laborHours
  const totalIndirectCost = Object.values(indirectCosts).reduce((sum, cost) => sum + cost, 0)
  const totalCost = totalMaterialCost + laborCost + totalIndirectCost

  const addIngredient = (ingredient: IngredientCatalogItem) => {
    setSelectedIngredients((current) => [...current, { ...ingredient, usage: 0.1 }])
    setIngredientQuery('')
  }

  const updateUsage = (id: string, usage: number) => {
    setSelectedIngredients((current) => current.map((ingredient) =>
      ingredient.id === id ? { ...ingredient, usage: Math.max(0, usage) } : ingredient,
    ))
  }

  const removeIngredient = (id: string) => {
    setSelectedIngredients((current) => current.filter((item) => item.id !== id))
  }

  const updateIndirectCost = (field: keyof IndirectCosts, value: number) => {
    setIndirectCosts((current) => ({ ...current, [field]: Math.max(0, value) }))
  }

  const saveRecipe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!productName.trim() || selectedIngredients.length === 0) return

    onCreate({
      id: `SKU-${new Date().getFullYear()}-${String(nextProductNumber).padStart(3, '0')}`,
      name: productName.trim(),
      description: description.trim() || `${selectedIngredients.length}개 재료로 구성된 신규 레시피.`,
      yieldRate: 100,
      materialCost: Math.round(totalMaterialCost),
      ingredientCount: selectedIngredients.length,
      status: 'review',
      ingredients: selectedIngredients.map((ingredient) => ({
        name: ingredient.name,
        usage: ingredient.usage,
        unit: ingredient.unit,
        cost: Math.round(ingredient.unitPrice * ingredient.usage),
      })),
      laborCost: Math.round(laborCost),
      indirectCosts: [
        { name: '전기세', amount: indirectCosts.electricity },
        { name: '식대', amount: indirectCosts.meal },
        { name: '이자 비용', amount: indirectCosts.interest },
      ],
    })
  }

  return {
    productName, setProductName, description, setDescription,
    ingredientQuery, setIngredientQuery, selectedIngredients, availableIngredients,
    hourlyWage, setHourlyWage, laborHours, setLaborHours, indirectCosts,
    totalMaterialCost, laborCost, totalIndirectCost, totalCost,
    addIngredient, updateUsage, removeIngredient, updateIndirectCost, saveRecipe,
  }
}
