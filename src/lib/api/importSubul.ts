/**
 * 수불자료 업로드 파이프라인
 *   파싱(parseSubul) → 이름 매칭 → 미매칭 확인 → 저장(material_usages)
 *
 * 실제 장부에 제품코드·재료코드 열이 없어서 **한글 이름으로 매칭**한다.
 * 이름 매칭은 오타에 약하므로, 저장 전에 미매칭 목록을 화면에 보여주고
 * 사용자가 확인하도록 두 단계(preview → commit)로 나눴다.
 */
import { supabase } from '../supabase'
import { parseSubulWorkbook, type SubulSheet } from '../excel/parseSubul'
import type { MaterialUnit } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** 공백 제거 + 소문자화. '고춧가루 (국)' 과 '고춧가루(국)' 을 같게 본다 */
const key = (s: string) => s.replace(/\s/g, '').toLocaleLowerCase('ko-KR')

export type PreviewLine = {
  row: number
  materialName: string
  materialId: string | null
  qty: number
  unitPrice: number
  amount: number
}

export type PreviewSheet = {
  productName: string
  productId: string | null
  lines: PreviewLine[]
  total: number
  /** 장부 합계와의 차이 (반올림 오차 확인용) */
  statedTotal: number | null
}

export type SubulPreview = {
  sheets: PreviewSheet[]
  missingProducts: string[]
  missingMaterials: string[]
  warnings: string[]
  /** 저장 가능한 행 수 */
  readyCount: number
}

// ── 1단계: 파싱 + 매칭 ──────────────────────────────────────
export async function previewSubul(file: File): Promise<SubulPreview> {
  const { sheets, warnings } = await parseSubulWorkbook(await file.arrayBuffer())

  if (sheets.length === 0) {
    return { sheets: [], missingProducts: [], missingMaterials: [], warnings, readyCount: 0 }
  }

  // 이름 매칭은 대소문자·공백을 무시해야 해서 전체를 받아 클라이언트에서 맞춘다.
  // 마스터 데이터라 행 수가 작다.
  const products = unwrap(
    await supabase.from('products').select('id, name, sku').eq('is_active', true),
  ) as { id: string; name: string; sku: string }[]
  const materials = unwrap(
    await supabase.from('materials').select('id, name, code').eq('is_active', true),
  ) as { id: string; name: string; code: string }[]

  const productByName = new Map(products.map((p) => [key(p.name), p.id]))
  const materialByName = new Map(materials.map((m) => [key(m.name), m.id]))

  const missingProducts = new Set<string>()
  const missingMaterials = new Set<string>()
  let readyCount = 0

  const previewSheets: PreviewSheet[] = sheets.map((sheet: SubulSheet) => {
    const productId = productByName.get(key(sheet.productName)) ?? null
    if (!productId) missingProducts.add(sheet.productName)

    const lines: PreviewLine[] = sheet.lines.map((line) => {
      const materialId = materialByName.get(key(line.materialName)) ?? null
      if (!materialId) missingMaterials.add(line.materialName)
      if (materialId && productId) readyCount += 1

      return {
        row: line.row,
        materialName: line.materialName,
        materialId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.qty * line.unitPrice,
      }
    })

    return {
      productName: sheet.productName,
      productId,
      lines,
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      statedTotal: sheet.statedTotal,
    }
  })

  return {
    sheets: previewSheets,
    missingProducts: [...missingProducts],
    missingMaterials: [...missingMaterials],
    warnings,
    readyCount,
  }
}

// ── 미매칭 재료를 한 번에 등록 ──────────────────────────────
/** 미매칭 재료를 materials 에 만들고, 다시 preview 하면 매칭된다. */
export async function createMissingMaterials(
  names: string[],
  unitPriceByName: Record<string, number> = {},
) {
  if (names.length === 0) return
  unwrap(
    await supabase.from('materials').insert(
      names.map((name, i) => ({
        code: `MAT-${Date.now()}-${i}`,
        name,
        unit: 'kg' as MaterialUnit,
        unit_price: unitPriceByName[name] ?? 0,
      })),
    ),
  )
}

// ── 2단계: 저장 ─────────────────────────────────────────────
/**
 * 매칭된 행만 material_usages 에 저장한다.
 * @returns 저장된 행 수
 */
export async function commitSubul(periodId: string, preview: SubulPreview): Promise<number> {
  const rows = preview.sheets.flatMap((sheet) =>
    sheet.productId === null
      ? []
      : sheet.lines.flatMap((line) =>
          line.materialId === null
            ? []
            : [{
                period_id: periodId,
                product_id: sheet.productId as string,
                material_id: line.materialId,
                usage_qty: line.qty,
                unit: 'kg',
                unit_price: line.unitPrice,
                source: 'excel',
              }],
        ),
  )

  if (rows.length === 0) return 0

  unwrap(
    await supabase
      .from('material_usages')
      .upsert(rows, { onConflict: 'period_id,product_id,material_id' }),
  )
  return rows.length
}
