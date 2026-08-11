/**
 * 수불자료(.xlsx) 파서 — 실제 장부 양식 기준
 *
 * 양식 (수불자료.xlsx / 수불자료_26.08.xlsx 확인):
 *   - 시트 하나가 제품 하나. 시트 이름이 곧 제품명 ('포기김치', '맛김치')
 *   - '업로드_템플릿' 등 템플릿 시트는 건너뛴다
 *   - 헤더 행 위치가 파일마다 다르다 (3행 또는 4행) → '품명' 이 있는 행을 찾는다
 *   - 열: 품명 | 수량(kg) | 단가(원) | 금액(원)
 *   - '합계' 행에서 멈춘다
 *   - '품명 작성' 은 템플릿의 빈 자리이므로 무시한다
 *
 * 금액 열은 읽기만 하고 쓰지 않는다. DB 의 amount 는 generated 컬럼이라
 * 수량 × 단가로 다시 계산된다 (장부의 반올림 오차는 여기서 흡수된다).
 */
export type SubulLine = {
  /** 엑셀의 행 번호 (1-based). 오류 메시지에 쓴다 */
  row: number
  materialName: string
  qty: number
  unitPrice: number
  /** 장부에 적힌 금액. 검증용이며 저장하지 않는다 */
  statedAmount: number | null
}

export type SubulSheet = {
  productName: string
  lines: SubulLine[]
  /** 장부 하단 '합계' 값. 검증용 */
  statedTotal: number | null
}

export type SubulParseResult = {
  sheets: SubulSheet[]
  warnings: string[]
}

/** 템플릿·안내용 시트는 데이터가 아니다 */
const SKIP_SHEET = /템플릿|양식|샘플|안내|가이드/

/** 헤더 후보. 공백·괄호를 걷어내고 비교한다 */
const norm = (v: unknown) => String(v ?? '').replace(/\s/g, '')
const bare = (v: unknown) => norm(v).replace(/\(.*?\)/g, '')

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  // '1,234.5' '1 234' '₩1,234' 모두 허용
  const cleaned = String(v).replace(/[,\s₩원]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** 헤더 행을 찾아 열 인덱스를 돌려준다. 못 찾으면 null */
function findHeader(rows: unknown[][]) {
  for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
    const cells = rows[r] ?? []
    const idx = { name: -1, qty: -1, price: -1, amount: -1 }

    cells.forEach((cell, c) => {
      const b = bare(cell)
      if (b === '품명' || b === '품목' || b === '재료명') idx.name = c
      else if (b === '수량' || b === '사용량' || b === '투입량') idx.qty = c
      else if (b === '단가') idx.price = c
      else if (b === '금액') idx.amount = c
    })

    if (idx.name >= 0 && idx.qty >= 0 && idx.price >= 0) return { headerRow: r, idx }
  }
  return null
}

export async function parseSubulWorkbook(buffer: ArrayBuffer): Promise<SubulParseResult> {
  // SheetJS 는 400KB 가 넘는다. 엑셀을 올릴 때만 받아오도록 동적 import 한다.
  const XLSX = await import('xlsx')
  const book = XLSX.read(buffer)
  const sheets: SubulSheet[] = []
  const warnings: string[] = []

  for (const sheetName of book.SheetNames) {
    if (SKIP_SHEET.test(sheetName)) continue

    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
      header: 1,
      blankrows: true,
      raw: true,
    })

    const header = findHeader(rows)
    if (!header) {
      warnings.push(`'${sheetName}' 시트에서 '품명 / 수량 / 단가' 헤더를 찾지 못해 건너뛰었습니다.`)
      continue
    }

    const { headerRow, idx } = header
    const lines: SubulLine[] = []
    let statedTotal: number | null = null

    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const cells = rows[r] ?? []
      const rawName = norm(cells[idx.name])

      // 합계 행을 만나면 종료
      if (rawName === '합계' || rawName === '계' || rawName === '총계') {
        statedTotal = toNumber(cells[idx.amount >= 0 ? idx.amount : idx.qty])
        break
      }
      // 템플릿의 빈 자리
      if (!rawName || rawName === '품명작성') continue

      const qty = toNumber(cells[idx.qty])
      const unitPrice = toNumber(cells[idx.price])

      // 수량·단가가 둘 다 비어 있으면 미사용 재료로 보고 건너뛴다
      if (qty === null && unitPrice === null) continue
      if (qty === null || unitPrice === null) {
        warnings.push(`'${sheetName}' ${r + 1}행 '${rawName}': 수량 또는 단가가 비어 있어 건너뛰었습니다.`)
        continue
      }

      lines.push({
        row: r + 1,
        materialName: String(cells[idx.name]).trim(),
        qty,
        unitPrice,
        statedAmount: idx.amount >= 0 ? toNumber(cells[idx.amount]) : null,
      })
    }

    if (lines.length === 0) {
      warnings.push(`'${sheetName}' 시트에 입력된 재료가 없어 건너뛰었습니다.`)
      continue
    }

    sheets.push({ productName: sheetName.trim(), lines, statedTotal })
  }

  return { sheets, warnings }
}

/**
 * 장부에 적힌 금액과 수량×단가가 어긋나는 행을 찾는다.
 * 수불자료는 손글씨를 전사한 것이라 반올림 차이가 있다. 1원 초과만 보고한다.
 */
export function findAmountMismatches(sheet: SubulSheet, tolerance = 1) {
  return sheet.lines
    .filter((line) => line.statedAmount !== null)
    .map((line) => ({
      line,
      computed: line.qty * line.unitPrice,
      diff: Math.abs(line.qty * line.unitPrice - (line.statedAmount as number)),
    }))
    .filter((item) => item.diff > tolerance)
}
