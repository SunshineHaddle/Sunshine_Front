/** docs/api/03-cost-entry.md §5·§6 — 생산량 / 원재료 투입 실적 */
import { supabase } from '../supabase'
import { num, type MaterialUnit } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export type ProductionLine = {
  productId: string
  sku: string
  name: string
  production: number
  defect: number
  /** 설계서 §4-2 3단계: 불량률 3종 */
  inboundDefectRate: number
  processWasteRate: number
  finishedDefectRate: number
}

/** 최종 수율 = (1-입고불량)(1-공정폐기)(1-완제품불량) × 100 */
export function calcYieldRate(
  inbound: string | number,
  process: string | number,
  finished: string | number,
) {
  const y =
    (1 - num(inbound) / 100) * (1 - num(process) / 100) * (1 - num(finished) / 100) * 100
  return Math.round(y * 100) / 100
}

// ── §5-1. 생산량 조회 ───────────────────────────────────────
export async function fetchProduction(periodId: string): Promise<ProductionLine[]> {
  const rows = unwrap(
    await supabase
      .from('production_records')
      .select(
        'product_id, production_qty, defect_qty, inbound_defect_rate,' +
          ' process_waste_rate, finished_defect_rate, products(sku, name)',
      )
      .eq('period_id', periodId),
  ) as unknown as Record<string, unknown>[]

  return rows.map((row) => {
    const product = row.products as { sku: string; name: string } | null
    return {
      productId: String(row.product_id),
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      production: num(row.production_qty),
      defect: num(row.defect_qty),
      inboundDefectRate: num(row.inbound_defect_rate),
      processWasteRate: num(row.process_waste_rate),
      finishedDefectRate: num(row.finished_defect_rate),
    }
  })
}

// ── §5-2. 생산량 저장 ───────────────────────────────────────
export async function saveProduction(
  periodId: string,
  rows: {
    productId: string
    production: string | number
    defect?: string | number
    inboundDefectRate?: string | number
    processWasteRate?: string | number
    finishedDefectRate?: string | number
  }[],
) {
  if (rows.length === 0) return

  unwrap(
    await supabase.from('production_records').upsert(
      rows.map((row) => ({
        period_id: periodId,
        product_id: row.productId,
        // 화면 입력은 문자열이라 빈 칸이 그대로 가면 22P02 가 난다
        production_qty: num(row.production),
        defect_qty: num(row.defect),
        inbound_defect_rate: num(row.inboundDefectRate),
        process_waste_rate: num(row.processWasteRate),
        finished_defect_rate: num(row.finishedDefectRate),
      })),
      { onConflict: 'period_id,product_id' },
    ),
  )
}

// ── §6-1. 투입 실적 조회 ────────────────────────────────────
export type UsageLine = {
  productId: string
  materialCode: string
  materialName: string
  usage: number
  unit: MaterialUnit
  unitPrice: number
  amount: number
  source: string
}

export async function fetchMaterialUsages(
  periodId: string,
  productId?: string,
): Promise<UsageLine[]> {
  let query = supabase
    .from('material_usages')
    .select('product_id, usage_qty, unit, unit_price, amount, source, materials(code, name)')
    .eq('period_id', periodId)
  if (productId) query = query.eq('product_id', productId)

  const rows = unwrap(await query) as unknown as {
    product_id: string
    usage_qty: number
    unit: MaterialUnit
    unit_price: number
    amount: number
    source: string
    materials: { code: string; name: string } | null
  }[]

  return rows.map((row) => ({
    productId: row.product_id,
    materialCode: row.materials?.code ?? '',
    materialName: row.materials?.name ?? '',
    usage: num(row.usage_qty),
    unit: row.unit,
    unitPrice: num(row.unit_price),
    amount: num(row.amount),
    source: row.source,
  }))
}

// ── §6-2. 투입 실적 저장 ────────────────────────────────────
export async function saveMaterialUsages(
  periodId: string,
  lines: {
    productId: string
    materialId: string
    usage: number
    unit?: MaterialUnit
    unitPrice: number
    source?: string
  }[],
) {
  if (lines.length === 0) return

  unwrap(
    await supabase.from('material_usages').upsert(
      lines.map((line) => ({
        period_id: periodId,
        product_id: line.productId,
        material_id: line.materialId,
        usage_qty: num(line.usage),
        unit: line.unit ?? 'kg',
        unit_price: num(line.unitPrice),
        source: line.source ?? 'manual',
      })),
      { onConflict: 'period_id,product_id,material_id' },
    ),
  )
}

// ── §6-3. 투입 실적 삭제 ────────────────────────────────────
export async function deleteMaterialUsages(periodId: string, productId?: string) {
  let query = supabase.from('material_usages').delete().eq('period_id', periodId)
  if (productId) query = query.eq('product_id', productId)
  unwrap(await query)
}
