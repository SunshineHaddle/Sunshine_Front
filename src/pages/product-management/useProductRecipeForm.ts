import { useMemo, useState, type FormEvent } from 'react'
import {
  ingredientCatalog,
  type IngredientCatalogItem,
  type IngredientUnit,
  type RecipeProduct,
} from './productManagementData'

export type SelectedIngredient = IngredientCatalogItem & { usage: number }

type UseProductRecipeFormOptions = {
  nextProductNumber: number
  onCreate: (product: RecipeProduct) => void
}

export function useProductRecipeForm({ nextProductNumber, onCreate }: UseProductRecipeFormOptions) {
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([])

  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientPrice, setNewIngredientPrice] = useState('')
  const [newIngredientUnit, setNewIngredientUnit] = useState<IngredientUnit>('kg')

  const availableIngredients = useMemo(() => {
    const query = ingredientQuery.trim().toLocaleLowerCase('ko-KR')
    return ingredientCatalog.filter((ingredient) =>
      !selectedIngredients.some((selected) => selected.id === ingredient.id)
      && (!query || ingredient.name.toLocaleLowerCase('ko-KR').includes(query)),
    )
  }, [ingredientQuery, selectedIngredients])

  const totalMaterialCost = selectedIngredients.reduce((total, ingredient) => total + ingredient.unitPrice * ingredient.usage, 0)
  const totalCost = totalMaterialCost

  const addIngredient = (ingredient: IngredientCatalogItem) => {
    setSelectedIngredients((current) => [...current, { ...ingredient, usage: 0.1 }])
    setIngredientQuery('')
  }

  const addNewIngredient = () => {
    const name = newIngredientName.trim()
    const price = Number(newIngredientPrice)
    if (!name || !Number.isFinite(price) || price < 0) return false

    setSelectedIngredients((current) => [
      ...current,
      {
        id: `MAT-NEW-${Date.now()}`,
        name,
        unit: newIngredientUnit,
        unitPrice: price,
        usage: 0.1,
      },
    ])
    setNewIngredientName('')
    setNewIngredientPrice('')
    setNewIngredientUnit('kg')
    return true
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
        name: ingredient.name,
        usage: ingredient.usage,
        unit: ingredient.unit,
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
