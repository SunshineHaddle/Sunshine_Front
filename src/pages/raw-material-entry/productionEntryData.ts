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

/**
 * 업로드용 엑셀 양식(CSV)을 생성해 다운로드합니다.
 * 엑셀에서 바로 열리도록 UTF-8 BOM을 붙여 한글 깨짐을 방지합니다.
 */
export function downloadProductionTemplate() {
  const header = ['품명', '수량', '단가', '금액']

  const csv = header.join(',')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '원재료_입력_양식.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
