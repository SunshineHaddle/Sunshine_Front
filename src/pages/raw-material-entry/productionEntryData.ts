/**
 * 1단계에서 내려받는 수불자료 빈 양식. public/ 에 있는 파일을 그대로 준다.
 *
 * 파일명에 기준 월을 박는다 ('수불자료_26.08.xlsx').
 * 엑셀 안에는 월이 적혀 있지 않아서 파일명이 유일한 단서인데(EXCEL.md §3-1),
 * 받을 때부터 월이 들어가 있으면 업로드할 때 monthFromFileName() 이 읽어
 * 다른 달에 저장하는 사고를 막아준다.
 *
 * @param month 'YYYY-MM'. 1단계에서 고른 기준 월
 */
export function downloadProductionTemplate(month: string) {
  // '2026-08' → '26.08'. monthFromFileName 이 인식하는 형식이다
  const stamp = /^\d{4}-\d{2}$/.test(month)
    ? `${month.slice(2, 4)}.${month.slice(5, 7)}`
    : ''
  const fileName = stamp ? `수불자료_${stamp}.xlsx` : '수불자료_양식.xlsx'

  const link = document.createElement('a')
  link.href = `${import.meta.env.BASE_URL}수불자료_양식.xlsx`
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
