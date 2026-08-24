/**
 * 1단계에서 내려받는 수불자료 빈 양식을 만든다.
 *
 * 고객이 쓰는 실제 장부 형식을 그대로 따른다:
 *   1행 제품명 · 2행 빈 줄 · 3행 헤더 · 4행부터 자료 · 금액 = 수량 × 단가
 *
 * 서식(남색 헤더 · 테두리 · 합계 행 강조 · 틀 고정)은 처음 손으로 만든 양식을
 * 따른다. SheetJS 무료판은 셀 서식을 쓰지 못해 exceljs 로 만든다.
 *
 * 파서(src/lib/excel/parseSubul.ts)와의 약속:
 *   - 시트 이름이 곧 제품명. '안내' 가 들어간 시트는 건너뛴다
 *   - '품명' 이 있는 행을 헤더로 찾는다 (행 위치는 자유)
 *   - '합계' 를 만나면 그 시트를 끝낸다
 *
 * 실행: node scripts/build-subul-template.mjs
 */
import ExcelJS from 'exceljs'

const OUT = 'public/수불자료_양식.xlsx'
const SHEET_COUNT = 10
const DATA_ROWS = 30
const HEADER_ROW = 3
const FIRST_DATA_ROW = HEADER_ROW + 1
const TOTAL_ROW = FIRST_DATA_ROW + DATA_ROWS

const FONT = '맑은 고딕'
const NAVY = 'FF1F4E5F'
const LIGHT_BLUE = 'FFDDEBF7'
const LINE = { style: 'thin', color: { argb: 'FFBFBFBF' } }
const BOX = { top: LINE, left: LINE, bottom: LINE, right: LINE }

const wb = new ExcelJS.Workbook()
wb.creator = 'Sunshine'

// ── 안내 시트 (파서가 건너뜀) ─────────────────────────────────────────
const guide = wb.addWorksheet('안내')
guide.columns = [{ width: 5 }, { width: 80 }]
const lines = [
  ['수불자료 업로드 안내'],
  [],
  ['1', '시트 이름을 제품명으로 바꿔주세요. 시트 이름이 곧 제품명입니다.'],
  ['', '   예) 새제품1 → 포기김치'],
  ['2', '1행에도 같은 제품명을 적어주세요 (사람이 보는 용도입니다).'],
  ['3', '품명은 원재료 이름과 글자까지 같아야 합니다. 다르면 새 재료로 등록됩니다.'],
  ['4', '수량과 단가만 채우면 금액은 자동으로 계산됩니다.'],
  ['5', '쓰지 않는 시트는 지우고 올려주세요.'],
  [],
  ['※ 이 안내 시트는 업로드할 때 자동으로 무시됩니다.'],
]
lines.forEach((l) => guide.addRow(l))
guide.getRow(1).font = { name: FONT, size: 14, bold: true }
for (let r = 3; r <= 8; r += 1) {
  guide.getRow(r).font = { name: FONT, size: 11 }
  guide.getCell(r, 1).alignment = { horizontal: 'center' }
}
guide.getRow(10).font = { name: FONT, size: 9, italic: true, color: { argb: 'FF666666' } }

// ── 제품 시트 ──────────────────────────────────────────────────────────
for (let n = 1; n <= SHEET_COUNT; n += 1) {
  const name = `새제품${n}`
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  })
  ws.columns = [{ width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }]

  // 1행 제품명
  ws.getCell('A1').value = name
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true }
  ws.getRow(1).height = 22

  // 3행 헤더
  const headers = ['품명', '수량(kg)', '단가(원)', '금액(원)']
  headers.forEach((h, i) => {
    const c = ws.getCell(HEADER_ROW, i + 1)
    c.value = h
    c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = BOX
  })
  ws.getRow(HEADER_ROW).height = 20

  // 자료 행 — 금액 = 수량 × 단가
  for (let r = FIRST_DATA_ROW; r < TOTAL_ROW; r += 1) {
    ws.getCell(r, 1).font = { name: FONT, size: 11 }
    ws.getCell(r, 2).numFmt = '#,##0.##'
    ws.getCell(r, 3).numFmt = '#,##0'
    ws.getCell(r, 4).value = { formula: `B${r}*C${r}` }
    ws.getCell(r, 4).numFmt = '#,##0'
    ws.getCell(r, 4).font = { name: FONT, size: 11, color: { argb: 'FF808080' } }
    for (let c = 1; c <= 4; c += 1) {
      ws.getCell(r, c).border = BOX
      if (c > 1) ws.getCell(r, c).font = { ...ws.getCell(r, c).font, name: FONT, size: 11 }
    }
    ws.getRow(r).height = 17
  }

  // 합계 행 — 파서는 '합계' 를 만나면 그 시트를 끝낸다
  ws.getCell(TOTAL_ROW, 1).value = '합계'
  ws.getCell(TOTAL_ROW, 4).value = { formula: `SUM(D${FIRST_DATA_ROW}:D${TOTAL_ROW - 1})` }
  ws.getCell(TOTAL_ROW, 4).numFmt = '#,##0'
  for (let c = 1; c <= 4; c += 1) {
    const cell = ws.getCell(TOTAL_ROW, c)
    cell.font = { name: FONT, size: 11, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    cell.border = BOX
  }
  ws.getRow(TOTAL_ROW).height = 18
}

await wb.xlsx.writeFile(OUT)
console.log(`양식 생성 완료 — 시트 ${SHEET_COUNT}개 + 안내, 각 ${DATA_ROWS}행 -> ${OUT}`)
