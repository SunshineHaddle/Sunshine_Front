/** 1단계에서 내려받는 수불자료 빈 양식. public/ 에 있는 파일을 그대로 준다 */
export function downloadProductionTemplate() {
  const link = document.createElement('a')
  link.href = `${import.meta.env.BASE_URL}수불자료_양식.xlsx`
  link.download = '수불자료_양식.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
