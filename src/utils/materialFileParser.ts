import { readSheet } from 'read-excel-file/browser'

export type MaterialPreviewRow = {
  id: string
  name: string
  quantity: string
  unitCost: string
}

export type MaterialPreview = {
  rows: MaterialPreviewRow[]
}

type MaterialColumn = 'name' | 'quantity' | 'unitCost'

const columnAliases: Record<MaterialColumn, string[]> = {
  name: ['품명', '자재명', '재료명', '재료이름', '원재료명', '품목명', 'material', 'name'],
  quantity: ['수량', '중량', '사용량', 'quantity', 'qty'],
  unitCost: ['단가', '원가', '단위원가', 'unitcost', 'price'],
}

const normalizeHeader = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_()[\]{}₩$/.-]/g, '')

const findColumnIndex = (headers: unknown[], column: MaterialColumn) => headers.findIndex((header) => {
  const normalized = normalizeHeader(header)
  return columnAliases[column].some((alias) => normalized === alias || normalized.startsWith(alias))
})

const parseCsv = (source: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const nextCharacter = source[index + 1]

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(value)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  row.push(value)
  if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

const getRows = async (file: File): Promise<unknown[][]> => {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(await file.text())
  }

  return readSheet(file)
}

export async function parseMaterialFile(file: File): Promise<MaterialPreview> {
  const rawRows = await getRows(file)
  const headerRowIndex = rawRows.slice(0, 10).findIndex((row) => (
    findColumnIndex(row, 'name') >= 0
    && findColumnIndex(row, 'quantity') >= 0
    && findColumnIndex(row, 'unitCost') >= 0
  ))

  if (headerRowIndex < 0) {
    throw new Error('품명, 수량, 단가 열을 찾을 수 없습니다.')
  }

  const headers = rawRows[headerRowIndex]
  const nameIndex = findColumnIndex(headers, 'name')
  const quantityIndex = findColumnIndex(headers, 'quantity')
  const unitCostIndex = findColumnIndex(headers, 'unitCost')
  const rows = rawRows.slice(headerRowIndex + 1)
    .filter((row) => String(row[nameIndex] ?? '').trim())
    .map((row) => ({
      id: crypto.randomUUID(),
      name: String(row[nameIndex] ?? '').trim(),
      quantity: String(row[quantityIndex] ?? '').trim(),
      unitCost: String(row[unitCostIndex] ?? '').trim(),
    }))

  if (rows.length === 0) {
    throw new Error('표시할 원재료 데이터가 없습니다.')
  }

  return { rows }
}
