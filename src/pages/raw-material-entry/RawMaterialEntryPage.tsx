import { useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'

type RawMaterialEntryPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

type Material = {
  id: number
  name: string
  specification: string
  quantity: number
  unitCost: number
}

const initialMaterials: Material[] = []

const formatWon = (value: number) => new Intl.NumberFormat('ko-KR').format(value)

export function RawMaterialEntryPage({ onNavigate, onAction }: RawMaterialEntryPageProps) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [form, setForm] = useState({ name: '', specification: '', quantity: '', unitCost: '' })
  const [fileName, setFileName] = useState('')

  const total = materials.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)

  const addMaterial = () => {
    const quantity = Number(form.quantity)
    const unitCost = Number(form.unitCost)
    if (!form.name.trim() || !form.specification.trim() || quantity <= 0 || unitCost <= 0) {
      onAction('자재명, 규격, 수량, 단가를 모두 입력해주세요.')
      return
    }

    setMaterials((current) => [
      ...current,
      {
        id: Date.now(),
        name: form.name.trim(),
        specification: form.specification.trim(),
        quantity,
        unitCost,
      },
    ])
    setForm({ name: '', specification: '', quantity: '', unitCost: '' })
    onAction('원재료를 목록에 추가했습니다.')
  }

  const downloadTemplate = () => {
    const csv = '\ufeff자재명,규격,수량,단가\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'raw-material-template.csv'
    link.click()
    URL.revokeObjectURL(url)
    onAction('원재료 업로드 양식을 다운로드했습니다.')
  }

  const saveDraft = () => {
    window.localStorage.setItem('cost-analysis-materials', JSON.stringify(materials))
    onAction('원재료 현황을 임시 저장했습니다.')
  }

  return (
    <div className="raw-materials-layout">
      <Sidebar activeRoute="data-entry-1" onNavigate={onNavigate} />

      <main className="raw-materials-page">
        <nav className="workflow-breadcrumb" aria-label="현재 위치">
          <Icon name="home" size={14} />
          <Icon name="chevron-right" size={13} />
          <span>Data Entry</span>
          <Icon name="chevron-right" size={13} />
          <strong>Step 1: 원재료 현황</strong>
        </nav>

        <header className="workflow-page-heading">
          <h1>데이터 입력 1단계: 원재료 현황</h1>
          <p>제품 생산에 필요한 원자재 목록과 재고 현황을 입력하거나 엑셀 파일로 일괄 업로드하세요.</p>
        </header>

        <div className="raw-materials-entry-grid">
          <section className="workflow-card upload-card" aria-labelledby="upload-title">
            <span className="upload-card__icon"><Icon name="upload" size={25} /></span>
            <h2 id="upload-title">엑셀 데이터 불러오기</h2>
            <p>기존 양식에 맞춰 작성된 엑셀<br />(.xlsx) 또는 CSV 파일을 업로드하여<br />데이터를 빠르게 입력하세요.</p>
            <label className="file-picker">
              <Icon name="upload" size={15} />
              <span>{fileName || '파일 선택'}</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    setFileName(file.name)
                    onAction(`${file.name} 파일을 선택했습니다.`)
                  }
                }}
              />
            </label>
            <button className="template-download" type="button" onClick={downloadTemplate}>
              ↓ 업로드 양식 다운로드
            </button>
          </section>

          <section className="workflow-card material-form" aria-labelledby="material-form-title">
            <h2 id="material-form-title"><Icon name="add" size={20} /> 신규 원재료 개별 입력</h2>
            <div className="material-form__fields">
              <label>자재명
                <input
                  value={form.name}
                  placeholder="자재명을 입력하세요"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>규격
                <input
                  value={form.specification}
                  placeholder="규격을 입력하세요"
                  onChange={(event) => setForm({ ...form, specification: event.target.value })}
                />
              </label>
              <label>수량
                <input
                  min="0"
                  type="number"
                  value={form.quantity}
                  placeholder="0"
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                />
              </label>
              <label>단가(₩)
                <input
                  min="0"
                  type="number"
                  value={form.unitCost}
                  placeholder="0"
                  onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
                />
              </label>
            </div>
            <button className="workflow-soft-button material-form__submit" type="button" onClick={addMaterial}>
              목록에 추가
            </button>
          </section>
        </div>

        <section className="workflow-card materials-table-card" aria-labelledby="materials-title">
          <div className="materials-table-card__heading">
            <h2 id="materials-title"><Icon name="calculator" size={19} /> 자재 재고 현황 목록</h2>
            <div><Icon name="filter" size={15} /><Icon name="more" size={16} /></div>
          </div>
          <div className="workflow-table-scroll">
            <table>
              <thead><tr><th scope="col">자재명</th><th scope="col">규격</th><th scope="col">수량</th><th scope="col">단가(₩)</th><th scope="col">금액(₩)</th><th scope="col">관리</th></tr></thead>
              <tbody>
                {materials.length === 0 ? (
                  <tr><td className="workflow-empty-table" colSpan={6}>등록된 원재료가 없습니다.</td></tr>
                ) : (
                  materials.map((material) => (
                    <tr key={material.id}>
                      <td>{material.name}</td><td>{material.specification}</td><td>{formatWon(material.quantity)}</td>
                      <td>{formatWon(material.unitCost)}</td><td><strong>{formatWon(material.quantity * material.unitCost)}</strong></td>
                      <td><button aria-label={`${material.name} 삭제`} type="button" onClick={() => setMaterials((current) => current.filter((item) => item.id !== material.id))}><Icon name="trash" size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="raw-materials-footer">
          <div className="raw-materials-total">
            <span><Icon name="calculator" size={19} /></span>
            <p>예상 총 금액<strong>₩ {formatWon(total)}</strong></p>
          </div>
          <div>
            <button className="workflow-outline-button" type="button" onClick={saveDraft}>임시 저장</button>
            <button className="workflow-primary-button" type="button" onClick={() => onNavigate('data-entry-2')}>
              다음 단계: 제조 공정 입력 <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
