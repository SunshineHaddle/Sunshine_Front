// node src/pages/raw-material-entry/monthFromFileName.test.mjs
// RawMaterialEntryPage 의 monthFromFileName 정규식 self-check
import assert from 'node:assert/strict'

function monthFromFileName(fileName) {
  const full = fileName.match(/(20\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (full) return `${full[1]}-${full[2]}`
  const short = fileName.match(/(?<!\d)(\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (short) return `20${short[1]}-${short[2]}`
  return null
}

// 실제 파일명 (두 자리 연도)
assert.equal(monthFromFileName('수불자료_테스트_26.09.xlsx'), '2026-09')
assert.equal(monthFromFileName('수불자료_26.08.xlsx'), '2026-08')

// 네 자리 연도
assert.equal(monthFromFileName('수불자료_2026-09.xlsx'), '2026-09')
assert.equal(monthFromFileName('수불자료_2026.12.xlsx'), '2026-12')
assert.equal(monthFromFileName('subul_2026_01.xlsx'), '2026-01')

// 네 자리가 두 자리보다 우선한다
assert.equal(monthFromFileName('2026.09_수불자료.xlsx'), '2026-09')

// 월이 될 수 없는 값은 잡지 않는다
assert.equal(monthFromFileName('수불자료_26.13.xlsx'), null)
assert.equal(monthFromFileName('수불자료_26.00.xlsx'), null)

// 단서가 없으면 null — 경고를 띄우지 않는다
assert.equal(monthFromFileName('수불자료.xlsx'), null)
assert.equal(monthFromFileName('최종본_final.xlsx'), null)

// 긴 숫자열 안의 우연한 일치는 피한다
assert.equal(monthFromFileName('20260912345.xlsx'), null)

console.log('ok')
