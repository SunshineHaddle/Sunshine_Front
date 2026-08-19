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
 * 페이지 경계에서 가로로 잘리면 안 되는 덩어리.
 * 카드 하나, 제품 그래프 하나, 표의 한 줄이 여기 해당한다.
 * 직접 지정하고 싶으면 엘리먼트에 data-pdf-block 을 달면 된다.
 */
const BLOCK_SELECTOR = '[data-pdf-block], .card, .product-cost-slide, tbody tr'

type Block = { top: number; bottom: number }

/** 화면 좌표(px)를 캔버스 좌표로 바꿔 잘리면 안 되는 구간 목록을 만든다 */
function collectBlocks(element: HTMLElement, ratio: number): Block[] {
  const base = element.getBoundingClientRect().top
  const blocks: Block[] = []
  element.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach((node) => {
    if (node.closest('[data-html2canvas-ignore]')) return
    const rect = node.getBoundingClientRect()
    if (rect.height <= 0) return
    blocks.push({
      top: (rect.top - base) * ratio,
      bottom: (rect.bottom - base) * ratio,
    })
  })
  return blocks
}

/**
 * 이번 페이지를 어디서 끊을지 고른다.
 *
 * 기본은 페이지 높이만큼(idealCut). 그 자리가 어떤 덩어리의 한가운데라면
 * 그 덩어리가 시작하기 전으로 당겨 통째로 다음 장에 넘긴다.
 * 여러 개가 걸쳐 있으면 가장 바깥(먼저 시작한) 것을 기준으로 삼아야
 * 카드 안의 한 줄만 살리고 카드 테두리는 잘리는 일이 없다.
 */
function chooseCut(blocks: Block[], pageStart: number, idealCut: number, pageHeightPx: number) {
  let cut = idealCut
  for (const block of blocks) {
    if (block.top <= pageStart + 1) continue // 이번 페이지보다 먼저 시작한 덩어리
    if (block.top >= idealCut || block.bottom <= idealCut) continue // 경계에 걸치지 않는다
    if (block.bottom - block.top > pageHeightPx) continue // 한 장보다 큰 덩어리는 어차피 잘린다
    cut = Math.min(cut, block.top)
  }
  return cut > pageStart + 1 ? cut : idealCut
}

/**
 * 지정한 DOM 엘리먼트를 캡처해 A4 세로 PDF로 저장한다.
 * 내용이 한 페이지보다 길면 카드·표 줄 단위로 끊어 여러 페이지에 나눠 담는다.
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

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // 캔버스 1mm 가 몇 px 인지. 가로를 A4 폭에 꽉 맞추므로 가로 기준으로 구한다
  const pxPerMm = canvas.width / pageWidth
  const pageHeightPx = pageHeight * pxPerMm

  const domWidth = element.getBoundingClientRect().width
  const blocks = domWidth > 0 ? collectBlocks(element, canvas.width / domWidth) : []

  const slice = document.createElement('canvas')
  const context = slice.getContext('2d')

  let pageStart = 0
  let isFirstPage = true
  // 무한 루프 방지용 상한. 실제로는 십수 장을 넘지 않는다
  for (let guard = 0; pageStart < canvas.height - 1 && guard < 200; guard += 1) {
    const idealCut = Math.min(pageStart + pageHeightPx, canvas.height)
    const cut = idealCut >= canvas.height
      ? canvas.height
      : chooseCut(blocks, pageStart, idealCut, pageHeightPx)
    const sliceHeight = Math.ceil(cut - pageStart)

    slice.width = canvas.width
    slice.height = sliceHeight
    if (context) {
      // 잘린 자리를 남기지 않게 배경부터 깔고 해당 구간만 옮겨 그린다
      context.fillStyle = backgroundColor
      context.fillRect(0, 0, slice.width, slice.height)
      context.drawImage(canvas, 0, pageStart, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
    }

    if (!isFirstPage) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, sliceHeight / pxPerMm)

    isFirstPage = false
    pageStart = cut
  }

  pdf.save(fileName)
}
