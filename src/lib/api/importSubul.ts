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
import { createProductWithRecipe } from './products'

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
  /** 엑셀을 고쳐야 하는 문제. 비어 있지 않으면 저장을 막는다 */
  errors: string[]
  /** 저장 가능한 행 수 */
  readyCount: number
}

// ── 1단계: 파싱 + 매칭 ──────────────────────────────────────
export async function previewSubul(file: File): Promise<SubulPreview> {
  const { sheets, warnings, errors } = await parseSubulWorkbook(await file.arrayBuffer())

  if (sheets.length === 0) {
    return {
      sheets: [], missingProducts: [], missingMaterials: [], warnings, errors, readyCount: 0,
    }
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
    errors,
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

// ── 미매칭 제품을 한 번에 등록 ──────────────────────────────
/**
 * 수불자료 시트명으로 제품과 재료 목록을 만든다.
 * 월간 수량·단가는 표준 배합이 아니므로 recipe_items 에 복사하지 않고,
 * 재료 연결만 0원·0kg 으로 등록한다. 실제 값은 material_usages 에 저장된다.
 *
 * 판매가·unit_weight_kg 는 0/빈 값이라 마진율이 실제와 다르게 나온다.
 * 제품 관리에서 채워야 한다는 안내를 호출부가 띄운다.
 *
 * @returns 실제로 만들어진 제품 수
 */
export async function createMissingProducts(sheets: PreviewSheet[]): Promise<number> {
  const missing = sheets.filter((sheet) => sheet.productId === null)
  if (missing.length === 0) return 0
  const stamp = Date.now()
  // ponytail: 제품별 RPC라 중간 실패 시 앞 제품은 남는다. 일괄 원자성이 필요해지면 bulk RPC로 교체한다.
  await Promise.all(missing.map((sheet, index) => {
    if (sheet.lines.some((line) => line.materialId === null)) {
      throw new Error(`${sheet.productName}의 미등록 원재료를 먼저 등록해 주세요.`)
    }

    const items = [...new Map(sheet.lines.map((line) => [line.materialId as string, {
      materialId: line.materialId as string,
      usage: 0,
      unit: 'kg' as MaterialUnit,
      unitPrice: 0,
    }])).values()]

    return createProductWithRecipe({
      sku: `PRD-${stamp}-${index}`,
      name: sheet.productName,
      description: `${items.length}개 재료로 엑셀에서 자동 등록된 레시피.`,
      items,
    })
  }))

  return missing.length
}

// ── 2단계: 저장 ─────────────────────────────────────────────
/**
 * 매칭된 행만 material_usages 에 저장한다.
 * @returns 저장된 행 수
 */
export async function commitSubul(periodId: string, preview: SubulPreview): Promise<number> {
  // 읽지 못한 행이 있는 채로 저장하면 그 재료만 빠진 원가가 조용히 확정된다.
  // 버튼도 막지만, 여기서 한 번 더 세운다.
  if (preview.errors.length > 0) {
    throw new Error(
      `엑셀에서 읽지 못한 행이 ${preview.errors.length}건 있습니다. `
      + '해당 행을 수정한 뒤 다시 올려주세요.',
    )
  }
  if (preview.missingProducts.length > 0 || preview.missingMaterials.length > 0) {
    throw new Error('등록되지 않은 제품 또는 원재료가 있어 저장할 수 없습니다.')
  }

  // 마감된 회차면 아래 delete 는 RLS 에 걸러져 0건이 되고(오류가 안 난다),
  // insert 만 거부된다. 그러면 예전 투입내역이 그대로 남아 "저장했는데 화면이
  // 그대로"인 상태가 된다. 손대기 전에 여기서 분명히 막는다.
  const period = unwrap(
    await supabase.from('cost_periods').select('status').eq('id', periodId).single(),
  ) as { status: string }
  if (period.status === 'confirmed') {
    throw new Error(
      '이 달은 마감되어 있어 투입내역을 바꿀 수 없습니다. '
      + '1단계에서 [마감 풀고 수정] 을 누른 뒤 다시 저장해주세요.',
    )
  }

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

  // 이 회차의 기존 투입내역을 먼저 지운다. 새 수불자료가 이 달의 전체이므로,
  // 지우지 않으면 예전 파일에만 있던 제품이 남아 목록·원가에 섞인다.
  unwrap(await supabase.from('material_usages').delete().eq('period_id', periodId))

  unwrap(
    await supabase
      .from('material_usages')
      .upsert(rows, { onConflict: 'period_id,product_id,material_id' }),
  )
  return rows.length
}
