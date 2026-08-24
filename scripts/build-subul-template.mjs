/**
 * 1단계에서 내려받는 수불자료 빈 양식을 만든다.
 *
 * 고객 장부(수불자료_유효성.xlsx 의 '업로드_템플릿' 시트)를 그대로 따른다:
 *   1행 제목 · 2행 안내 · 4행 헤더 · 5행부터 공통 재료 14개 미리 채움
 *   (첫 줄은 작성 예시) · 새 재료용 '품명 작성' 4줄 · 합계 · 하단 주석
 *   수량·단가 칸에 유효성 검사 (숫자·0 이상만), 금액 = ROUND(수량 × 단가)
 *
 * 서식은 SheetJS 무료판이 쓰지 못해 exceljs 로 만든다.
 *
 * 파서(src/lib/excel/parseSubul.ts)와의 약속:
 *   - 시트 이름이 곧 제품명. '안내' 가 들어간 시트는 건너뛴다
 *   - '품명' 이 있는 행을 헤더로 찾는다 (15행 안)
 *   - 수량·단가가 둘 다 빈 재료는 안 쓴 것으로 조용히 건너뛴다
 *   - '품명 작성' 은 빈 자리로 무시하고, '합계' 를 만나면 그 시트를 끝낸다
 *
 * 실행: node scripts/build-subul-template.mjs
 */
import ExcelJS from 'exceljs'

const OUT = 'public/수불자료_양식.xlsx'
const SHEET_COUNT = 10

// 공통 재료. 고객 장부 순서 그대로
const MATERIALS = [
  '배추', '무', '고춧가루(국)', '고춧가루(수)', '마늘', '생강', '멸치액젓',
  '대파', '조미료', '설탕', '물엿', '찹쌀미', '매실액기스', '천일염',
]
const EXTRA_ROWS = 4                  // '품명 작성' 새 재료 칸
const EXAMPLE = { qty: 83064, price: 865.51 }

const HEADER_ROW = 4
const FIRST_DATA_ROW = HEADER_ROW + 1
const LAST_DATA_ROW = FIRST_DATA_ROW + MATERIALS.length + EXTRA_ROWS - 1
const TOTAL_ROW = LAST_DATA_ROW + 1

const FONT = '맑은 고딕'
const NAVY = 'FF1F4E5F'
const LIGHT_BLUE = 'FFDDEBF7'
const GRAY = 'FF808080'
const LINE = { style: 'thin', color: { argb: 'FFBFBFBF' } }
const BOX = { top: LINE, left: LINE, bottom: LINE, right: LINE }
const FMT = { qty: '#,##0.0', price: '#,##0.00', amount: '#,##0' }

const NOTE_FONT = { name: FONT, size: 9, italic: true, color: { argb: 'FF666666' } }

const validation = (label, particle, unit, max) => ({
  type: 'decimal',
  operator: 'between',
  formulae: [0, max],
  allowBlank: true,
  showInputMessage: true,
  showErrorMessage: true,
  promptTitle: `${label}(${unit}) 입력`,
  prompt: `숫자만 입력하세요. 0 이상 ${max.toLocaleString('ko-KR')} 이하 (소수점 가능).\n해당 없으면 비워두세요.`,
  errorTitle: '입력값 오류',
  error: `${label}${particle} 0 이상 ${max.toLocaleString('ko-KR')} 이하의 숫자만 입력할 수 있습니다.\n문자, 음수, 쉼표(,)나 단위(${unit})는 넣지 마세요.`,
})

const wb = new ExcelJS.Workbook()
wb.creator = 'Sunshine'

// ── 안내 시트 (파서가 건너뜀) ─────────────────────────────────────────
const guide = wb.addWorksheet('안내')
guide.columns = [{ width: 5 }, { width: 84 }]
;[
  ['수불자료 업로드 안내'],
  [],
  ['1', '시트 이름을 제품명으로 바꿔주세요. 시트 이름이 곧 제품명입니다.'],
  ['', '   예) 새제품1 → 포기김치'],
  ['2', '공통 재료 14개는 미리 채워져 있습니다. 수량과 단가만 적으면 금액과 합계는 자동 계산됩니다.'],
  ['3', '첫 줄(배추)의 수량·단가는 작성 예시입니다. 지우고 실제 값을 넣어주세요.'],
  ['4', '안 쓰는 재료는 수량·단가를 비워두면 됩니다. 새 재료는 아래 \'품명 작성\' 칸에 적어주세요.'],
  ['5', '품명은 원재료 이름과 글자까지 같아야 합니다. 다르면 새 재료로 등록됩니다.'],
  ['6', '쓰지 않는 시트는 지우고 올려주세요.'],
  [],
  ['※ 이 안내 시트는 업로드할 때 자동으로 무시됩니다.'],
].forEach((l) => guide.addRow(l))
guide.getRow(1).font = { name: FONT, size: 14, bold: true }
for (let r = 3; r <= 9; r += 1) {
  guide.getRow(r).font = { name: FONT, size: 11 }
  guide.getCell(r, 1).alignment = { horizontal: 'center' }
}
guide.getRow(11).font = NOTE_FONT

// ── 제품 시트 ──────────────────────────────────────────────────────────
for (let n = 1; n <= SHEET_COUNT; n += 1) {
  const name = `새제품${n}`
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, topLeftCell: `A${FIRST_DATA_ROW}` }],
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  })
  ws.columns = [{ width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 30 }]

  // 1행 제목 · 2행 안내
  ws.getCell('A1').value = `${name} — 월간 원재료 투입내역`
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true }
  ws.getRow(1).height = 18
  ws.getCell('A2').value =
    '공통 재료 14개는 미리 채워져 있습니다. 수량과 단가만 입력하시면 금액과 합계는 자동으로 계산됩니다.'
  ws.getCell('A2').font = NOTE_FONT

  // 4행 헤더
  ;['품명', '수량(kg)', '단가(원)', '금액(원)'].forEach((h, i) => {
    const c = ws.getCell(HEADER_ROW, i + 1)
    c.value = h
    c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = BOX
  })
  ws.getRow(HEADER_ROW).height = 16.5

  // 자료 행
  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r += 1) {
    const i = r - FIRST_DATA_ROW
    const isExample = i === 0
    const isExtra = i >= MATERIALS.length
    const body = { name: FONT, size: 11 }
    const exampleFont = { ...body, italic: true, color: { argb: GRAY } }

    const nameCell = ws.getCell(r, 1)
    nameCell.value = isExtra ? '품명 작성' : MATERIALS[i]
    nameCell.font = isExtra ? { ...body, color: { argb: GRAY } } : body

    const qty = ws.getCell(r, 2)
    const price = ws.getCell(r, 3)
    const amount = ws.getCell(r, 4)
    qty.numFmt = FMT.qty
    price.numFmt = FMT.price
    amount.numFmt = FMT.amount
    amount.value = { formula: `IF(OR(B${r}="",C${r}=""),"",ROUND(B${r}*C${r},0))` }
    qty.font = isExample ? exampleFont : body
    price.font = isExample ? exampleFont : body
    amount.font = isExample ? exampleFont : body
    if (isExample) {
      qty.value = EXAMPLE.qty
      price.value = EXAMPLE.price
      ws.getCell(r, 5).value = '← 작성 예시입니다. 지우고 입력하세요.'
      ws.getCell(r, 5).font = NOTE_FONT
    }
    for (let c = 1; c <= 4; c += 1) ws.getCell(r, c).border = BOX
    ws.getRow(r).height = 16.5
  }

  // 유효성 검사 — 수량·단가 칸은 0 이상 숫자만
  ws.dataValidations.add(`B${FIRST_DATA_ROW}:B${LAST_DATA_ROW}`, validation('수량', '은', 'kg', 1_000_000))
  ws.dataValidations.add(`C${FIRST_DATA_ROW}:C${LAST_DATA_ROW}`, validation('단가', '는', '원', 10_000_000))

  // 합계 행 — 파서는 '합계' 를 만나면 그 시트를 끝낸다
  ws.getCell(TOTAL_ROW, 1).value = '합계'
  ws.getCell(TOTAL_ROW, 4).value = {
    formula: `IF(COUNT(D${FIRST_DATA_ROW}:D${LAST_DATA_ROW})=0,"",SUM(D${FIRST_DATA_ROW}:D${LAST_DATA_ROW}))`,
  }
  ws.getCell(TOTAL_ROW, 4).numFmt = FMT.amount
  for (let c = 1; c <= 4; c += 1) {
    const cell = ws.getCell(TOTAL_ROW, c)
    cell.font = { name: FONT, size: 11, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    cell.border = BOX
  }
  ws.getRow(TOTAL_ROW).height = 16.5

  // 하단 주석
  ws.getCell(TOTAL_ROW + 2, 1).value =
    `※ 첫 줄(${MATERIALS[0]})의 수량·단가는 작성 예시입니다. 안 쓰는 재료는 수량·단가를 비워두면 금액에 잡히지 않고, 마지막 ${EXTRA_ROWS}줄은 새 재료 추가용입니다.`
  ws.getCell(TOTAL_ROW + 3, 1).value =
    '※ 수량·단가 칸은 유효성 검사가 걸려 있어 숫자 외의 값(문자·음수)은 입력되지 않습니다.'
  ws.getCell(TOTAL_ROW + 2, 1).font = NOTE_FONT
  ws.getCell(TOTAL_ROW + 3, 1).font = NOTE_FONT
}

await wb.xlsx.writeFile(OUT)
console.log(
  `양식 생성 완료 — 시트 ${SHEET_COUNT}개 + 안내, 재료 ${MATERIALS.length}개 + 추가 ${EXTRA_ROWS}줄 -> ${OUT}`,
)
