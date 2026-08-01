export type MaterialRow = {
  id: string
  name: string
  quantity: string
  unitCost: string
}

export type DefaultRecipeIngredient = {
  id: string
  name: string
  unit: 'kg'
  unitPrice: number
  usage: number
}

export const DEFAULT_RECIPE_STORAGE_KEY = 'sunshine.default-recipe.v1'

export function parseDefaultRecipe(value: string | null): DefaultRecipeIngredient[] | null {
  try {
    const recipe: unknown = JSON.parse(value ?? 'null')
    if (!Array.isArray(recipe) || recipe.length === 0) return null

    return recipe.every((ingredient) => {
      if (!ingredient || typeof ingredient !== 'object') return false
      const item = ingredient as Partial<DefaultRecipeIngredient>
      return typeof item.id === 'string'
        && typeof item.name === 'string'
        && item.unit === 'kg'
        && Number.isFinite(item.unitPrice)
        && Number.isFinite(item.usage)
    }) ? recipe as DefaultRecipeIngredient[] : null
  } catch {
    return null
  }
}
