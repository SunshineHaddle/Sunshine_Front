import { initialRecipeProducts } from '../product-management/productManagementData'

export type ProductionEntryRow = {
  id: string
  name: string
  production: string
}

export const PRODUCTION_ENTRY_STORAGE_KEY = 'sunshine.production-entry.v1'

export function buildSampleProductionRows(): ProductionEntryRow[] {
  return initialRecipeProducts.map((product) => ({
    id: product.id,
    name: product.name,
    production: '',
  }))
}

export function downloadProductionTemplate() {
  const link = document.createElement('a')
  link.href = `${import.meta.env.BASE_URL}수불자료_양식.xlsx`
  link.download = '수불자료_양식.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function parseStoredProductionRows(value: string | null): ProductionEntryRow[] | null {
  try {
    const rows: unknown = JSON.parse(value ?? 'null')
    if (!Array.isArray(rows) || rows.length === 0) return null

    return rows.every((row) => {
      if (!row || typeof row !== 'object') return false
      const item = row as Partial<ProductionEntryRow>
      return typeof item.id === 'string'
        && typeof item.name === 'string'
        && typeof item.production === 'string'
    }) ? rows as ProductionEntryRow[] : null
  } catch {
    return null
  }
}
