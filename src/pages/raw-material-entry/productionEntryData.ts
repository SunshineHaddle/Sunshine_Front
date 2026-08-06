import { initialRecipeProducts } from '../product-management/productManagementData'

export type ProductionEntryRow = {
  id: string
  name: string
  production: string
}

export const PRODUCTION_ENTRY_STORAGE_KEY = 'sunshine.production-entry.v1'

/**
 * 엑셀 업로드를 대신하는 샘플 데이터. 실제 엑셀 파싱은 아직 구현하지 않으며,
 * 업로드 동작 시 엑셀에 어떤 제품들이 있는지 확인할 수 있도록 제품 목록을 보여준다.
 */
export function buildSampleProductionRows(): ProductionEntryRow[] {
  return initialRecipeProducts.map((product) => ({
    id: product.id,
    name: product.name,
    production: '',
  }))
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
