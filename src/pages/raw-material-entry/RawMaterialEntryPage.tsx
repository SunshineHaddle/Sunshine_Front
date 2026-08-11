import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppRoute } from '../../data/navigation'
import { Icon } from '../../components/common/Icon'
import { NumberInput } from '../../components/common/NumberInput'
import { Sidebar } from '../../components/layout/Sidebar'
import type { RecipeProduct } from '../product-management/productManagementData'
import { downloadProductionTemplate } from './productionEntryData'
import {
  commitSubul,
  createMissingMaterials,
  previewSubul,
  type SubulPreview,
} from '../../lib/api/importSubul'
import {
  deleteMaterialUsages,
  fetchMaterialUsages,
  fetchProduction,
  saveProduction,
  type UsageLine,
} from '../../lib/api/production'
import {
  createDownloadUrl,
  deleteFile,
  fetchFileHistory,
  uploadExcel,
  type FileHistoryItem,
} from '../../lib/api/files'

type RawMaterialEntryPageProps = {
  products: RecipeProduct[]
  month: string
  periodId: string | null
  isLocked: boolean
  onMonthChange: (month: string) => void
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  hideSidebar?: boolean
}

/** 화면 입력은 문자열로 들고 있다가 저장 시 숫자로 바꾼다 */
type Row = {
  id: string
  name: string
  production: string
}

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

export function RawMaterialEntryPage({
  products,
  month,
  periodId,
  isLocked,
  onMonthChange,
  onNavigate,
  onAction,
  hideSidebar = false,
}: RawMaterialEntryPageProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [preview, setPreview] = useState<SubulPreview | null>(null)
  /** 원본 파일. 검증을 통과한 뒤 Storage 에 올린다 (§12-5) */
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState('')
  /** §6-1 이미 저장된 투입 실적 */
  const [usages, setUsages] = useState<UsageLine[]>([])
  /** §10-3 이 달에 올린 원본 파일 */
  const [history, setHistory] = useState<FileHistoryItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasRows = rows.length > 0
  const filledCount = rows.filter((row) => row.production.trim() !== '').length

  const reloadUsages = useCallback(async () => {
    if (!periodId) { setUsages([]); return }
    try { setUsages(await fetchMaterialUsages(periodId)) } catch { setUsages([]) }
  }, [periodId])

  const reloadHistory = useCallback(async () => {
    if (!periodId) { setHistory([]); return }
    // 버킷·테이블이 없어도 입력 작업은 막지 않는다
    try { setHistory(await fetchFileHistory({ periodId, limit: 10 })) } catch { setHistory([]) }
  }, [periodId])

  useEffect(() => { void reloadUsages() }, [reloadUsages])
  useEffect(() => { void reloadHistory() }, [reloadHistory])

  // §5-1 저장된 생산량을 제품 목록에 좌측 조인한다 (F-11).
  // 조인하지 않으면 아직 입력하지 않은 제품이 화면에서 사라진다.
  useEffect(() => {
    let cancelled = false
    const build = async () => {
      const saved = periodId ? await fetchProduction(periodId).catch(() => []) : []
      if (cancelled) return
      const byId = new Map(saved.map((s) => [s.productId, s]))
      setRows(products.map((product) => ({
        id: product.id,
        name: product.name,
        production: byId.has(product.id) ? String(byId.get(product.id)!.production) : '',
      })))
    }
    void build()
    return () => { cancelled = true }
  }, [periodId, products])

  const updateProduction = (id: string, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, production: value } : row)))
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return

    setBusy('수불자료를 읽는 중…')
    try {
      const result = await previewSubul(picked)
      setPreview(result)
      setFile(picked)
      setFileName(picked.name)
      const missing = result.missingProducts.length + result.missingMaterials.length
      onAction(
        missing > 0
          ? `${result.sheets.length}개 제품을 읽었습니다. 매칭되지 않은 항목이 있어 확인이 필요합니다.`
          : `${result.sheets.length}개 제품, ${result.readyCount}개 재료 행을 읽었습니다.`,
      )
    } catch (error) {
      onAction(`읽기 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy('')
    }
  }

  const registerMissing = async () => {
    if (!preview || preview.missingMaterials.length === 0) return
    setBusy('원재료를 등록하는 중…')
    try {
      // 엑셀에 적힌 단가를 초기값으로 넣어준다
      const priceByName: Record<string, number> = {}
      preview.sheets.forEach((sheet) =>
        sheet.lines.forEach((line) => {
          if (!line.materialId) priceByName[line.materialName] = line.unitPrice
        }),
      )
      await createMissingMaterials(preview.missingMaterials, priceByName)
      onAction(`원재료 ${preview.missingMaterials.length}개를 등록했습니다. 파일을 다시 올려주세요.`)
      setPreview(null)
      setFile(null)
      setFileName('')
    } catch (error) {
      onAction(`등록 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy('')
    }
  }

  /** §6-2 투입내역 저장 → §10-1·§10-2 원본 보관 */
  const commit = async () => {
    if (!preview || !periodId) return

    setBusy('투입내역을 저장하는 중…')
    let saved = 0
    try {
      saved = await commitSubul(periodId, preview)
      await reloadUsages()
    } catch (error) {
      setBusy('')
      onAction(`저장 실패: ${error instanceof Error ? error.message : String(error)}`)
      return
    }

    // 버킷이 없어도 위에서 저장한 투입내역은 유지되어야 하므로 따로 잡는다
    if (file) {
      setBusy('원본 파일을 보관하는 중…')
      try {
        await uploadExcel({ periodId, file, displayName: `${month} 수불자료`, rowCount: preview.readyCount })
        await reloadHistory()
        onAction(`투입내역 ${saved}행 저장 · 원본 파일 보관 완료`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onAction(
          message.includes('Bucket not found')
            ? `투입내역 ${saved}행은 저장했습니다. 원본 보관 실패 — Storage 에 excel-uploads 버킷(Private)을 만들어주세요.`
            : `투입내역 ${saved}행은 저장했습니다. 원본 보관 실패: ${message}`,
        )
      }
    } else {
      onAction(`원재료 투입내역 ${saved}행을 저장했습니다.`)
    }

    setPreview(null)
    setFile(null)
    setBusy('')
  }

  /** §10-4 Private 버킷이라 60초짜리 서명 URL 을 발급받는다 */
  const download = async (item: FileHistoryItem) => {
    try {
      window.open(await createDownloadUrl(item.storage_path, 60), '_blank')
    } catch (error) {
      onAction(`다운로드 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** §10-5 Storage 와 테이블 양쪽에서 지운다 */
  const removeFile = async (item: FileHistoryItem) => {
    if (!window.confirm(`${item.original_name} 원본을 삭제할까요?\n이미 저장된 투입내역은 그대로 남습니다.`)) return
    try {
      await deleteFile(item.id, item.storage_path)
      await reloadHistory()
      onAction('원본 파일을 삭제했습니다.')
    } catch (error) {
      onAction(`삭제 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** §6-3 지우면 마감 시 표준원가로 되돌아간다 */
  const removeUsages = async (productId: string, productName: string) => {
    if (!periodId) return
    if (!window.confirm(`${productName}의 투입내역을 모두 지울까요?\n마감 시 레시피 기준(표준원가)으로 계산됩니다.`)) return
    try {
      await deleteMaterialUsages(periodId, productId)
      await reloadUsages()
      onAction(`${productName} 투입내역을 삭제했습니다.`)
    } catch (error) {
      onAction(`삭제 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** §5-2 생산량 저장 */
  const persistProduction = async () => {
    if (!periodId) return false
    try {
      await saveProduction(periodId, rows.map((row) => ({ productId: row.id, production: row.production })))
      return true
    } catch (error) {
      onAction(`저장 실패: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  const saveDraft = async () => {
    if (await persistProduction()) onAction('제품 생산량을 임시 저장했습니다.')
  }

  const goToNextStep = async () => {
    if (await persistProduction()) onNavigate('data-entry-2')
  }

  const unmatched = useMemo(
    () => (preview ? preview.missingProducts.length + preview.missingMaterials.length : 0),
    [preview],
  )

  return (
    <div className="raw-materials-layout">
      {!hideSidebar && <Sidebar activeRoute="data-entry-1" onNavigate={onNavigate} />}

      <main className="raw-materials-page">
        <header className="workflow-page-heading entry-heading">
          <div>
            <h1>데이터 입력 1단계: 제품 생산량</h1>
            <p>수불자료(.xlsx)를 올리면 제품별 투입 재료가 등록됩니다. 생산량은 아래에서 직접 입력하세요.</p>
          </div>
          <label className="entry-month-picker">
            <span className="visually-hidden">기준 월</span>
            <Icon name="calendar" size={17} />
            <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
          </label>
        </header>

        {isLocked && (
          <p className="entry-locked" role="status">
            <Icon name="check" size={14} /> 이 달은 마감되었습니다. 값을 고치려면 3단계에서 <strong>마감 취소</strong>를 먼저 눌러주세요.
          </p>
        )}

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
                  <p>제품마다 시트가 하나씩 있고, 각 시트에 품명·수량·단가가 적힌 수불자료입니다.</p>
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
                disabled={Boolean(busy) || isLocked}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={16} /> {fileName ? '다시 업로드' : '엑셀 업로드'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="production-upload__input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
            />
          </section>

          {busy && <p className="entry-busy" role="status">{busy}</p>}

          {/* ── 업로드 미리보기 ───────────────────────────── */}
          {preview && (
            <section className="subul-preview" aria-labelledby="subul-preview-title">
              <header className="subul-preview__head">
                <h2 id="subul-preview-title">읽은 내용 확인</h2>
                <span className={`subul-preview__badge${unmatched ? ' is-warn' : ' is-ok'}`}>
                  {unmatched ? `미매칭 ${unmatched}건` : `${preview.readyCount}행 저장 가능`}
                </span>
              </header>

              <div className="subul-preview__sheets">
                {preview.sheets.map((sheet) => {
                  const gap = sheet.statedTotal === null ? 0 : Math.round(sheet.total - sheet.statedTotal)
                  return (
                    <article
                      className={`subul-sheet${sheet.productId ? '' : ' is-unmatched'}`}
                      key={sheet.productName}
                    >
                      <h3>
                        {sheet.productName}
                        {!sheet.productId && <em> — 등록되지 않은 제품</em>}
                      </h3>
                      <dl>
                        <div><dt>재료</dt><dd>{sheet.lines.length}개</dd></div>
                        <div><dt>재료비</dt><dd>{won(sheet.total)}원</dd></div>
                        {sheet.statedTotal !== null && (
                          <div>
                            <dt>장부 합계</dt>
                            <dd>
                              {won(sheet.statedTotal)}원
                              {gap !== 0 && <em className="subul-sheet__gap"> ({gap > 0 ? '+' : ''}{won(gap)})</em>}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  )
                })}
              </div>

              {preview.missingProducts.length > 0 && (
                <p className="subul-preview__missing">
                  <strong>등록되지 않은 제품:</strong> {preview.missingProducts.join(', ')}
                  <br />제품 관리에서 같은 이름으로 먼저 등록해주세요.
                </p>
              )}

              {preview.missingMaterials.length > 0 && (
                <div className="subul-preview__missing">
                  <p><strong>등록되지 않은 원재료:</strong> {preview.missingMaterials.join(', ')}</p>
                  <button type="button" className="workflow-outline-button" onClick={registerMissing}>
                    이 재료들 등록하기
                  </button>
                </div>
              )}

              {preview.warnings.map((warning) => (
                <p className="subul-preview__warning" key={warning}>{warning}</p>
              ))}

              <button
                className="workflow-primary-button"
                type="button"
                disabled={preview.readyCount === 0 || !periodId || Boolean(busy) || isLocked}
                onClick={commit}
              >
                투입내역 {preview.readyCount}행 저장 · 원본 보관 <Icon name="check" size={16} />
              </button>
            </section>
          )}

          {/* ── §10-3 이 달에 올린 원본 파일 ───────────────── */}
          {history.length > 0 && (
            <section className="upload-history" aria-labelledby="upload-history-title">
              <h2 id="upload-history-title">이 달에 올린 파일</h2>
              <ul>
                {history.map((item) => (
                  <li key={item.id}>
                    <div className="upload-history__meta">
                      <strong>{item.original_name}</strong>
                      <small>
                        {new Date(item.uploaded_at).toLocaleString('ko-KR', {
                          month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                        {item.size ? ` · ${Math.round(item.size / 1024).toLocaleString('ko-KR')} KB` : ''}
                        {item.row_count ? ` · ${item.row_count}행` : ''}
                      </small>
                    </div>
                    <button type="button" onClick={() => void download(item)}>
                      <Icon name="download" size={15} /> 원본 받기
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.original_name} 삭제`}
                      disabled={isLocked}
                      onClick={() => void removeFile(item)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── §6-1 저장된 투입 실적 ─────────────────────── */}
          {usages.length > 0 && (
            <section className="saved-usages" aria-labelledby="saved-usages-title">
              <header>
                <h2 id="saved-usages-title">저장된 투입내역</h2>
                <span>{usages.length}행</span>
              </header>
              {rows.map((row) => {
                const lines = usages.filter((usage) => usage.productId === row.id)
                if (lines.length === 0) return null
                const total = lines.reduce((sum, line) => sum + line.amount, 0)
                return (
                  <article className="saved-usages__product" key={row.id}>
                    <div className="saved-usages__head">
                      <strong>{row.name}</strong>
                      <span>재료 {lines.length}개 · {won(total)}원</span>
                      <button type="button" disabled={isLocked} onClick={() => void removeUsages(row.id, row.name)}>
                        <Icon name="trash" size={14} /> 삭제
                      </button>
                    </div>
                    <ul>
                      {lines.map((line) => (
                        <li key={line.materialCode || line.materialName}>
                          <span>{line.materialName}</span>
                          <span>{line.usage.toLocaleString('ko-KR')} {line.unit}</span>
                          <span>{won(line.unitPrice)}원</span>
                          <b>{won(line.amount)}원</b>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </section>
          )}

          {hasRows ? (
            <section className="production-list" aria-labelledby="production-list-title">
              <header className="production-list__heading">
                <div className="production-list__title">
                  <h2 id="production-list-title">제품별 생산량</h2>
                  <span className="production-list__count">{rows.length}개 제품</span>
                </div>
                <div className="production-list__meta">
                  <p>수불자료에는 생산량이 없습니다. 생산 일지를 보고 직접 입력하세요.</p>
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
              <p>등록된 제품이 없습니다</p>
              <span>제품 관리에서 제품을 먼저 등록해주세요.</span>
            </section>
          )}
        </div>

        <footer className="raw-materials-footer">
          <div>
            <button
              className="workflow-outline-button"
              type="button"
              onClick={() => void saveDraft()}
              disabled={!hasRows || !periodId || isLocked}
            >
              임시 저장
            </button>
            <button
              className="workflow-primary-button"
              type="button"
              onClick={() => void goToNextStep()}
              disabled={!hasRows || !periodId}
            >
              다음 단계: 제조 공정 입력 <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
