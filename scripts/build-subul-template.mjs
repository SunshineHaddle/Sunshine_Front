/**
 * 1단계에서 내려받는 수불자료 빈 양식을 만든다.
 *
 * 고객이 쓰는 실제 장부 형식을 그대로 따른다:
 *   1행 제품명 · 2행 빈 줄 · 3행 헤더 · 4행부터 자료 · 금액 = 수량 × 단가
 *
 * 예전 양식은 금액이 `=B2+C2` (더하기) 였다. 장부 금액은 저장하지 않고
 * 검증에만 쓰지만(⑤), 사람이 보는 합계가 틀리면 입력을 의심하게 된다.
 *
 * 실행: node scripts/build-subul-template.mjs
 */
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const SHEET_COUNT = 10
const DATA_ROWS = 30
const HEADER_ROW = 3           // 1-based
const FIRST_DATA_ROW = HEADER_ROW + 1

const wb = XLSX.utils.book_new()

// 안내 시트. 이름에 '안내' 가 들어가면 파서가 건너뛴다 (SKIP_SHEET)
const guide = XLSX.utils.aoa_to_sheet([
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
])
guide['!cols'] = [{ wch: 4 }, { wch: 78 }]
XLSX.utils.book_append_sheet(wb, guide, '안내')

for (let n = 1; n <= SHEET_COUNT; n += 1) {
  const rows = [
    [`새제품${n}`],                                   // 1행: 제품명
    [],                                               // 2행: 빈 줄
    ['품명', '수량(kg)', '단가(원)', '금액(원)'],      // 3행: 헤더
  ]
  for (let i = 0; i < DATA_ROWS; i += 1) rows.push(['', null, null, null])

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 금액 = 수량 × 단가. SheetJS 는 .f 에 '=' 없이 넣는다
  for (let i = 0; i < DATA_ROWS; i += 1) {
    const r = FIRST_DATA_ROW + i
    ws[`D${r}`] = { t: 'n', f: `B${r}*C${r}` }
  }

  // 합계 행 — 파서는 '합계' 를 만나면 그 시트를 끝낸다
  const totalRow = FIRST_DATA_ROW + DATA_ROWS
  ws[`A${totalRow}`] = { t: 's', v: '합계' }
  ws[`D${totalRow}`] = { t: 'n', f: `SUM(D${FIRST_DATA_ROW}:D${totalRow - 1})` }
  ws['!ref'] = `A1:D${totalRow}`
  ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }]

  XLSX.utils.book_append_sheet(wb, ws, `새제품${n}`)
}

writeFileSync('public/수불자료_양식.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`양식 생성 완료 — 시트 ${SHEET_COUNT}개 + 안내, 각 ${DATA_ROWS}행`)
