export const MATERIAL_TEMPLATE_FILE_NAME = '원재료_입력_양식.csv'

export const createMaterialTemplateCsv = () => '\uFEFF품명,수량(kg),단가(원)\r\n'

export function downloadMaterialTemplate() {
  const file = new Blob([createMaterialTemplateCsv()], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = MATERIAL_TEMPLATE_FILE_NAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
