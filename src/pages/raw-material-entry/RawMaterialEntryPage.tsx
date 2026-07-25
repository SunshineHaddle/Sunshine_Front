import { useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import { parseMaterialFile, type MaterialPreviewRow } from '../../utils/materialFileParser'
import { downloadMaterialTemplate } from '../../utils/materialTemplate'

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
          <p>품명, 수량(kg), 단가(원)를 직접 입력하거나 엑셀 파일로 일괄 업로드하세요.</p>
        </header>

        <div className="raw-materials-entry-grid">
          <div className="workflow-card raw-materials-entry-panel">
            <div className="material-template">
              <div>
                <strong>엑셀 양식이 필요하신가요?</strong>
                <span>Excel에서 열 수 있는 CSV 양식을 내려받아 작성한 뒤 업로드하세요.</span>
              </div>
              <button
                className="material-template__download"
                type="button"
                onClick={() => {
                  downloadMaterialTemplate()
                  onAction('원재료 입력 양식을 다운로드했습니다.')
                }}
              >
                <Icon name="download" size={16} />
                엑셀용 양식 다운로드 (.csv)
              </button>
            </div>

            <label className="upload-card" aria-labelledby="upload-title">
              <span className="upload-card__icon"><Icon name="upload" size={25} /></span>
              <h2 id="upload-title">엑셀 데이터 불러오기</h2>
              <p>품명·수량·단가 열이 있는 엑셀 파일을 선택하세요.<br />수량은 kg, 단가는 원 기준이며 소수점 값도 그대로 불러옵니다.</p>
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
                  <span>품명</span>
                  <span>수량(kg)</span>
                  <span>단가(원)</span>
                  <span>관리</span>
                </div>

                <div className="material-preview__rows">
                  {previewRows.map((row) => (
                    <div className="material-preview__row" key={row.id}>
                      <label>
                        <span className="material-preview__field-label">품명</span>
                        <input value={row.name} onChange={(event) => updatePreviewRow(row.id, 'name', event.target.value)} />
                      </label>
                      <label className="material-preview__number-field">
                        <span className="material-preview__field-label">수량(kg)</span>
                        <input aria-label={`${row.name} 수량(kg)`} value={row.quantity} inputMode="decimal" onChange={(event) => updatePreviewRow(row.id, 'quantity', event.target.value)} />
                        <em>kg</em>
                      </label>
                      <label className="material-preview__number-field">
                        <span className="material-preview__field-label">단가(원)</span>
                        <input aria-label={`${row.name} 단가(원)`} value={row.unitCost} inputMode="decimal" onChange={(event) => updatePreviewRow(row.id, 'unitCost', event.target.value)} />
                        <em>원</em>
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
