import { useRef, useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import { Sidebar } from '../../components/layout/Sidebar'
import {
  PARSED_MATERIALS_STORAGE_KEY,
  PRODUCTION_ENTRY_STORAGE_KEY,
  downloadProductionTemplate,
  parseSubulWorkbook,
  type ProductionEntryRow,
} from './productionEntryData'

type RawMaterialEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  hideSidebar?: boolean
}

export function RawMaterialEntryPage({ onNavigate, onAction, hideSidebar = false }: RawMaterialEntryPageProps) {
  const [rows, setRows] = useState<ProductionEntryRow[]>([])
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasRows = rows.length > 0
  const filledCount = rows.filter((row) => row.production.trim() !== '').length

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    try {
      const { products, warnings } = parseSubulWorkbook(await file.arrayBuffer())
      if (products.length === 0) {
        onAction(warnings[0] ?? '엑셀에서 제품을 찾지 못했습니다. 양식을 확인해 주세요.')
        return
      }
      setFileName(file.name)
      setRows(products.map((p) => ({ id: p.productName, name: p.productName, production: '' })))
      window.localStorage.setItem(PARSED_MATERIALS_STORAGE_KEY, JSON.stringify(products))
      const warn = warnings.length ? ` (경고 ${warnings.length}건)` : ''
      onAction(`${products.length}개 제품을 불러왔습니다. 제품별 생산량을 입력하세요.${warn}`)
    } catch {
      onAction('엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인해 주세요.')
    }
  }

  const updateProduction = (id: string, value: string) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, production: value } : row
    )))
  }

  const saveDraft = () => {
    window.localStorage.setItem(PRODUCTION_ENTRY_STORAGE_KEY, JSON.stringify(rows))
    onAction('제품 생산량을 임시 저장했습니다.')
  }

  const goToNextStep = () => {
    window.localStorage.setItem(PRODUCTION_ENTRY_STORAGE_KEY, JSON.stringify(rows))
    onNavigate('data-entry-2')
  }

  return (
    <div className="raw-materials-layout">
      {!hideSidebar && <Sidebar activeRoute="data-entry-1" onNavigate={onNavigate} />}

      <main className="raw-materials-page">
        <header className="workflow-page-heading">
          <h1>데이터 입력 1단계: 제품 생산량</h1>
          <p>엑셀 파일을 업로드하면 포함된 제품 목록을 확인할 수 있습니다. 제품별 생산량(kg)을 입력하세요.</p>
        </header>

        <div className="production-entry">
          <section className="production-upload" aria-labelledby="production-upload-title">
            <div className="production-upload__info">
              <span className="production-upload__badge">
                <img
                  className="production-upload__badge-img"
                  src="/excel-logo.png"
                  alt="엑셀"
                  onError={(event) => {
                    const img = event.currentTarget
                    img.style.display = 'none'
                    const fallback = img.nextElementSibling as HTMLElement | null
                    if (fallback) fallback.style.display = ''
                  }}
                />
                <span className="production-upload__badge-fallback" style={{ display: 'none' }}>
                  <Icon name="excel" size={24} />
                </span>
              </span>
              <div className="production-upload__text">
                <h2 id="production-upload-title">엑셀 파일 업로드</h2>
                {fileName ? (
                  <p className="production-upload__file">
                    <Icon name="check" size={13} /> {fileName}
                  </p>
                ) : (
                  <p>제품 정보가 담긴 엑셀(.xlsx) 파일을 올리면 제품 목록을 자동으로 불러옵니다.</p>
                )}
              </div>
            </div>
            <div className="production-upload__actions">
              <button
                className="production-upload__template"
                type="button"
                onClick={downloadProductionTemplate}
              >
                <Icon name="download" size={16} /> 엑셀 양식 다운로드
              </button>
              <button
                className="production-upload__button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={16} /> {fileName ? '다시 업로드' : '엑셀 업로드'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="production-upload__input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelected}
            />
          </section>

          {hasRows ? (
            <section className="production-list" aria-labelledby="production-list-title">
              <header className="production-list__heading">
                <div className="production-list__title">
                  <h2 id="production-list-title">엑셀 제품 목록</h2>
                  <span className="production-list__count">{rows.length}개 제품</span>
                </div>
                <div className="production-list__meta">
                  <p>엑셀에서 불러온 제품입니다. 각 제품의 생산량(kg)을 입력하세요.</p>
                  <span className="production-list__progress">
                    입력 완료 <strong>{filledCount}</strong> / {rows.length}
                  </span>
                </div>
              </header>

              <div className="production-list__labels" aria-hidden="true">
                <span>제품명</span>
                <span>생산량(kg)</span>
              </div>

              <div className="production-list__rows">
                {rows.map((row) => {
                  const isFilled = row.production.trim() !== ''
                  return (
                    <div className={`production-item${isFilled ? ' is-filled' : ''}`} key={row.id}>
                      <div className="production-item__name">
                        <span className="production-item__name-text">
                          <strong>{row.name}</strong>
                          <em>제품 · 생산량 입력 대상</em>
                        </span>
                        {isFilled && (
                          <span className="production-item__done" aria-label="입력 완료">
                            <Icon name="check" size={13} />
                          </span>
                        )}
                      </div>
                      <label className="production-item__field">
                        <span className="production-item__field-label">생산량(kg)</span>
                        <div className="production-item__input">
                          <NumberInput
                            aria-label={`${row.name} 생산량(kg)`}
                            min="0"
                            placeholder="생산량 입력"
                            value={row.production}
                            onValueChange={(raw) => updateProduction(row.id, raw)}
                          />
                          <em>kg</em>
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : (
            <section className="production-empty" aria-live="polite">
              <span className="production-empty__icon">
                <Icon name="factory" size={30} />
              </span>
              <p>아직 불러온 제품이 없습니다</p>
              <span>엑셀 파일을 업로드하면 포함된 제품 목록이 여기에 표시됩니다.</span>
            </section>
          )}
        </div>

        <footer className="raw-materials-footer">
          <div>
            <button className="workflow-outline-button" type="button" onClick={saveDraft} disabled={!hasRows}>
              임시 저장
            </button>
            <button className="workflow-primary-button" type="button" onClick={goToNextStep} disabled={!hasRows}>
              다음 단계: 제조 공정 입력 <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
