import * as XLSX from 'xlsx'

export type ProductionEntryRow = {
  id: string
  name: string
  production: string
}

export type ParsedMaterial = { name: string; quantityKg: number; unitPrice: number; amount: number }
export type ParsedProduct = { productName: string; materials: ParsedMaterial[]; totalAmount: number }
export type ExcelParseResult = { products: ParsedProduct[]; warnings: string[] }

const SKIP_NAMES = new Set(['합계', '품명 작성', '품명'])

function parseSheet(ws: XLSX.WorkSheet, sheetName: string, warnings: string[]): ParsedProduct | null {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false })
  const byName = new Map<string, ParsedMaterial>()

  for (const row of rows) {
    const name = String(row?.[0] ?? '').trim()
    if (!name || SKIP_NAMES.has(name)) continue
    const quantityKg = Number(row?.[1])
    const unitPrice = Number(row?.[2])
    if (!Number.isFinite(quantityKg) || !Number.isFinite(unitPrice)) continue // 헤더/예시/빈 행
    if (quantityKg < 0 || unitPrice < 0) {
      warnings.push(`${sheetName} · ${name}: 음수 값은 제외했습니다.`)
      continue
    }
    const amount = Math.round(quantityKg * unitPrice)
    const existing = byName.get(name)
    if (existing) {
      existing.quantityKg += quantityKg
      existing.amount += amount
    } else {
      byName.set(name, { name, quantityKg, unitPrice, amount })
    }
  }

  const materials = [...byName.values()]
  if (materials.length === 0) {
    return null
  }
  const totalAmount = materials.reduce((sum, m) => sum + m.amount, 0)
  return { productName: sheetName, materials, totalAmount }
}

export function parseSubulWorkbook(buffer: ArrayBuffer): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const products = wb.SheetNames
    .filter((name) => !name.includes('템플릿') && !name.toLowerCase().includes('template'))
    .map((name) => parseSheet(wb.Sheets[name], name, warnings))
    .filter((p): p is ParsedProduct => p !== null)
  return { products, warnings }
}

export const PRODUCTION_ENTRY_STORAGE_KEY = 'sunshine.production-entry.v1'
export const PARSED_MATERIALS_STORAGE_KEY = 'sunshine.parsed-materials.v1'

export function parseStoredMaterials(value: string | null): ParsedProduct[] | null {
  try {
    const products: unknown = JSON.parse(value ?? 'null')
    if (!Array.isArray(products) || products.length === 0) return null
    return products.every((p) => (
      p && typeof p === 'object'
      && typeof (p as ParsedProduct).productName === 'string'
      && Array.isArray((p as ParsedProduct).materials)
    )) ? products as ParsedProduct[] : null
  } catch {
    return null
  }
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
