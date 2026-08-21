/**
 * 파일명에서 기준 월을 추측한다. '수불자료_테스트_26.09.xlsx' → '2026-09'.
 * 확실한 정보가 아니므로 저장을 막지는 않고, 선택한 월과 다를 때만 알린다.
 * 엑셀 안에는 월이 적혀 있지 않아서 파일명이 유일한 단서다.
 */
export function monthFromFileName(fileName: string): string | null {
  // 2026-09 / 2026.09 / 2026_09
  const full = fileName.match(/(20\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (full) return `${full[1]}-${full[2]}`

  // 26.09 — 앞 두 자리가 연도로 보일 때만 (일(日)로 오해하지 않도록 구분자 필수)
  const short = fileName.match(/(?<!\d)(\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (short) return `20${short[1]}-${short[2]}`

  return null
}
