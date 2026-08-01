import { useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import {
  DEFAULT_RECIPE_STORAGE_KEY,
  parseDefaultRecipe,
  type MaterialRow,
} from '../../utils/materials'

type RawMaterialEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const createMaterialRow = (): MaterialRow => ({
  id: crypto.randomUUID(),
  name: '',
  quantity: '',
  unitCost: '',
})

function loadStoredMaterials() {
  try {
    const stored = window.localStorage.getItem('cost-analysis-material-preview')
    const rows = stored ? JSON.parse(stored) as MaterialRow[] : []
    return rows.length > 0 ? rows : [createMaterialRow()]
  } catch {
    return [createMaterialRow()]
  }
}

export function RawMaterialEntryPage({ onNavigate, onAction }: RawMaterialEntryPageProps) {
  const [previewRows, setPreviewRows] = useState<MaterialRow[]>(loadStoredMaterials)

  const updatePreviewRow = (id: string, field: keyof Omit<MaterialRow, 'id'>, value: string) => {
    setPreviewRows((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )))
  }

  const loadDefaultMaterials = () => {
    try {
      const recipe = parseDefaultRecipe(window.localStorage.getItem(DEFAULT_RECIPE_STORAGE_KEY))
      if (!recipe) {
        onAction('제품 관리에서 기본 레시피를 먼저 저장해주세요.')
        return
      }

      setPreviewRows(recipe.map((ingredient) => ({
        id: crypto.randomUUID(),
        name: ingredient.name,
        quantity: String(ingredient.usage),
        unitCost: String(ingredient.unitPrice),
      })))
      onAction(`기본 원재료 ${recipe.length}개를 불러왔습니다.`)
    } catch {
      onAction('기본 원재료를 불러오지 못했습니다.')
    }
  }

  const saveDraft = () => {
    window.localStorage.setItem('cost-analysis-material-preview', JSON.stringify(previewRows))
    onAction('원재료 현황을 임시 저장했습니다.')
  }

  const goToNextStep = () => {
    window.localStorage.setItem('cost-analysis-material-preview', JSON.stringify(previewRows))
    onNavigate('data-entry-2')
  }

  return (
    <div className="raw-materials-layout">
      <Sidebar activeRoute="data-entry-1" onNavigate={onNavigate} />

      <main className="raw-materials-page">
        <header className="workflow-page-heading">
          <h1>데이터 입력 1단계: 원재료 현황</h1>
          <p>품명, 수량(kg), 단가(원)를 직접 입력하세요.</p>
        </header>

        <div className="raw-materials-entry-grid">
          <div className="workflow-card raw-materials-entry-panel">
            <section className="material-preview" aria-labelledby="material-preview-title">
              <header className="material-preview__heading">
                <div className="material-preview__title">
                  <h2 id="material-preview-title">원재료 입력</h2>
                  <span>{previewRows.length}개</span>
                </div>
                <button className="material-preview__load" type="button" onClick={loadDefaultMaterials}>
                  기본값(Cost) 불러오기
                </button>
                <button
                  className="material-preview__add"
                  type="button"
                  onClick={() => setPreviewRows((current) => [...current, createMaterialRow()])}
                >
                  <Icon name="add" size={15} /> 원재료 추가
                </button>
              </header>

              <div className="material-preview__labels" aria-hidden="true">
                <span>품명</span>
                <span>수량(kg)</span>
                <span>단가(원)</span>
                <span>관리</span>
              </div>

              <div className="material-preview__rows">
                {previewRows.map((row, index) => (
                  <div className="material-preview__row" key={row.id}>
                    <label>
                      <span className="material-preview__field-label">품명</span>
                      <input placeholder="예: 밀가루" value={row.name} onChange={(event) => updatePreviewRow(row.id, 'name', event.target.value)} />
                    </label>
                    <label className="material-preview__number-field">
                      <span className="material-preview__field-label">수량(kg)</span>
                      <input aria-label={`${row.name || `원재료 ${index + 1}`} 수량(kg)`} min="0" step="any" type="number" value={row.quantity} onChange={(event) => updatePreviewRow(row.id, 'quantity', event.target.value)} />
                      <em>kg</em>
                    </label>
                    <label className="material-preview__number-field">
                      <span className="material-preview__field-label">단가(원)</span>
                      <input aria-label={`${row.name || `원재료 ${index + 1}`} 단가(원)`} min="0" step="any" type="number" value={row.unitCost} onChange={(event) => updatePreviewRow(row.id, 'unitCost', event.target.value)} />
                      <em>원</em>
                    </label>
                    <button
                      type="button"
                      aria-label={`${row.name || `원재료 ${index + 1}`} 삭제`}
                      onClick={() => setPreviewRows((current) => current.filter((item) => item.id !== row.id))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
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
