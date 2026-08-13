import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'

export type ExportPdfOptions = {
  /** 저장될 파일명. 확장자(.pdf)까지 포함한다 */
  fileName?: string
  /** 캡처 배율. 높을수록 선명하지만 파일 용량이 커진다 */
  scale?: number
  /** 캡처 배경색. 카드 밖 여백(캔버스 배경)과 맞춘다 */
  backgroundColor?: string
}

/**
 * 지정한 DOM 엘리먼트를 캡처해 A4 세로 PDF로 저장한다.
 * 내용이 한 페이지보다 길면 자동으로 여러 페이지에 나눠 담는다.
 * `data-html2canvas-ignore` 속성이 붙은 엘리먼트(예: 내보내기 버튼 자체)는 캡처에서 제외된다.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  { fileName = 'dashboard.pdf', scale = 2, backgroundColor = '#fbfbfb' }: ExportPdfOptions = {},
) {
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
  })

  const imageData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const imageWidth = pageWidth
  const imageHeight = (canvas.height * imageWidth) / canvas.width

  let heightLeft = imageHeight
  let position = 0

  pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imageHeight
    pdf.addPage()
    pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
    heightLeft -= pageHeight
  }

  pdf.save(fileName)
}
