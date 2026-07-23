import { useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import { parseMaterialFile, type MaterialPreviewRow } from '../../utils/materialFileParser'

type RawMaterialEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

function loadStoredMaterials() {
  try {
    const stored = window.localStorage.getItem('cost-analysis-material-preview')
    return stored ? JSON.parse(stored) as MaterialPreviewRow[] : []
  } catch {
    return []
  }
}

export function RawMaterialEntryPage({ onNavigate, onAction }: RawMaterialEntryPageProps) {
  const [fileName, setFileName] = useState(() => window.localStorage.getItem('cost-analysis-material-file') ?? '')
  const [previewRows, setPreviewRows] = useState<MaterialPreviewRow[]>(loadStoredMaterials)
  const [columnLabels, setColumnLabels] = useState({ quantity: '수량', unitCost: '단가' })
  const [fileError, setFileError] = useState('')

  const updatePreviewRow = (id: string, field: keyof Omit<MaterialPreviewRow, 'id'>, value: string) => {
    setPreviewRows((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )))
  }

  const handleFileChange = async (file?: File) => {
    if (!file) return

    setFileName(file.name)
    setFileError('')

    try {
      const preview = await parseMaterialFile(file)
      setPreviewRows(preview.rows)
      setColumnLabels({ quantity: preview.quantityLabel, unitCost: preview.unitCostLabel })
      onAction(`${file.name}에서 원재료 ${preview.rows.length}개를 불러왔습니다.`)
    } catch (error) {
      setPreviewRows([])
      const message = error instanceof Error ? error.message : '파일을 읽을 수 없습니다.'
      setFileError(message)
      onAction(message)
    }
  }

  const saveDraft = () => {
    window.localStorage.setItem('cost-analysis-material-file', fileName)
    window.localStorage.setItem('cost-analysis-material-preview', JSON.stringify(previewRows))
    onAction('원재료 현황을 임시 저장했습니다.')
  }

  const goToNextStep = () => {
    window.localStorage.setItem('cost-analysis-material-file', fileName)
    window.localStorage.setItem('cost-analysis-material-preview', JSON.stringify(previewRows))
    onNavigate('data-entry-2')
  }

  return (
    <div className="raw-materials-layout">
      <Sidebar activeRoute="data-entry-1" onNavigate={onNavigate} />

      <main className="raw-materials-page">
        <header className="workflow-page-heading">
          <h1>데이터 입력 1단계: 원재료 현황</h1>
          <p>제품 생산에 필요한 원자재 목록과 재고 현황을 입력하거나 엑셀 파일로 일괄 업로드하세요.</p>
        </header>

        <div className="raw-materials-entry-grid">
          <div className="workflow-card raw-materials-entry-panel">
            <label className="upload-card" aria-labelledby="upload-title">
              <span className="upload-card__icon"><Icon name="upload" size={25} /></span>
              <h2 id="upload-title">엑셀 데이터 불러오기</h2>
              <p>현재 클라이언트의 엑셀 양식이 확정되지 않았습니다.<br />실제 파일을 전달받은 후 데이터 구조를 확인하고 추출 기능을 개발하는 것이 좋습니다.</p>
              {fileName && <span className="upload-card__file-name">{fileName}</span>}
              <input
                className="upload-card__input"
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => void handleFileChange(event.target.files?.[0])}
              />
            </label>

            {fileError && <p className="material-preview__error" role="alert">{fileError}</p>}

            {previewRows.length > 0 && (
              <section className="material-preview" aria-labelledby="material-preview-title">
                <header className="material-preview__heading">
                  <h2 id="material-preview-title">불러온 원재료</h2>
                  <span>{previewRows.length}개</span>
                </header>

                <div className="material-preview__labels" aria-hidden="true">
                  <span>재료 이름</span>
                  <span>{columnLabels.quantity}</span>
                  <span>{columnLabels.unitCost}</span>
                  <span>관리</span>
                </div>

                <div className="material-preview__rows">
                  {previewRows.map((row) => (
                    <div className="material-preview__row" key={row.id}>
                      <label>
                        <span className="sr-only">재료 이름</span>
                        <input value={row.name} onChange={(event) => updatePreviewRow(row.id, 'name', event.target.value)} />
                      </label>
                      <label>
                        <span className="sr-only">{columnLabels.quantity}</span>
                        <input value={row.quantity} inputMode="decimal" onChange={(event) => updatePreviewRow(row.id, 'quantity', event.target.value)} />
                      </label>
                      <label>
                        <span className="sr-only">{columnLabels.unitCost}</span>
                        <input value={row.unitCost} inputMode="decimal" onChange={(event) => updatePreviewRow(row.id, 'unitCost', event.target.value)} />
                      </label>
                      <button
                        type="button"
                        aria-label={`${row.name} 삭제`}
                        onClick={() => setPreviewRows((current) => current.filter((item) => item.id !== row.id))}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="raw-materials-footer">
          <div>
            <button className="workflow-outline-button" type="button" onClick={saveDraft}>임시 저장</button>
            <button className="workflow-primary-button" type="button" onClick={goToNextStep}>
              다음 단계: 제조 공정 입력 <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
