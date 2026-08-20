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
  createMissingProducts,
  previewSubul,
  type SubulPreview,
} from '../../lib/api/importSubul'
import {
  fetchMaterialUsages,
  fetchProduction,
  fetchUsageProductIds,
  fetchUsageTotals,
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
import { markEntrySaved } from '../../utils/entrySaved'
import { describeDbError } from '../../lib/api/errors'
import { confirmPeriod } from '../../lib/api/results'
import { fetchPeriods, reopenPeriod } from '../../lib/api/periods'
import { fetchOperatingCosts } from '../../lib/api/operating'
import {
  describeBlockers,
  describeIssues,
  findConfirmBlockers,
  findProductionIssues,
} from '../production-result/productionSanity'
import type { CostPeriodRow } from '../../lib/types'

type RawMaterialEntryPageProps = {
  products: RecipeProduct[]
  month: string
  periodId: string | null
  /** worker 처럼 재접속 시 저장값을 화면에 불러오지 않고 빈 폼으로 시작 */
  freshEntry?: boolean
  onMonthChange: (month: string) => void
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  /** 제품을 새로 만든 뒤 App 의 제품 목록을 다시 읽게 한다 */
  onProductsChanged?: () => void | Promise<void>
  hideSidebar?: boolean
  /** 이 회차가 마감(잠금)되었는지. admin 1단계에서만 넘어온다 */
  isLocked?: boolean
  /** 마감/마감취소 후 App 이 회차 상태를 다시 읽게 한다 */
  onPeriodChanged?: () => void
}

/** 화면 입력은 문자열로 들고 있다가 저장 시 숫자로 바꾼다 */
type Row = {
  id: string
  name: string
  production: string
}

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

/**
 * 파일명에서 기준 월을 추측한다. '수불자료_테스트_26.09.xlsx' → '2026-09'.
 * 확실한 정보가 아니므로 저장을 막지는 않고, 선택한 월과 다를 때만 알린다.
 * 엑셀 안에는 월이 적혀 있지 않아서 파일명이 유일한 단서다.
 */
function monthFromFileName(fileName: string): string | null {
  // 2026-09 / 2026.09 / 2026_09
  const full = fileName.match(/(20\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (full) return `${full[1]}-${full[2]}`

  // 26.09 — 앞 두 자리가 연도로 보일 때만 (일(日)로 오해하지 않도록 구분자 필수)
  const short = fileName.match(/(?<!\d)(\d{2})[._-](0[1-9]|1[0-2])(?!\d)/)
  if (short) return `20${short[1]}-${short[2]}`

  return null
}

export function RawMaterialEntryPage({
  products,
  month,
  periodId,
  freshEntry = false,
  onMonthChange,
  onNavigate,
  onAction,
  onProductsChanged,
  hideSidebar = false,
  isLocked = false,
  onPeriodChanged,
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
  /** §4-2 저장된 모든 월 회차. 월별 마감 여부를 미리 보여주는 데 쓴다 */
  const [periods, setPeriods] = useState<CostPeriodRow[]>([])
  /** 파일명이 가리키는 월이 선택한 월과 다를 때만 채워진다 */
  const [monthMismatch, setMonthMismatch] = useState<string | null>(null)
  /**
   * 이 달 수불자료에 등장한 제품 id.
   * usages 와 달리 freshEntry 여부와 무관하게 읽는다 — 폼에 채우는 값이 아니라
   * 생산량 목록의 범위라서, 재접속했다고 사라지면 안 되는 정보다.
   */
  const [usageProductIds, setUsageProductIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 이 달 수불자료에 실제로 등장한 제품.
   * 새 파일을 읽는 중이면 그 미리보기만 기준으로 삼는다 — 예전에 저장돼 있던
   * 다른 제품의 투입내역과 섞이면, 이번 엑셀에 없는 제품까지 목록에 나온다.
   * 미리보기가 없으면(재접속 등) 저장된 투입내역 제품을 쓴다.
   */
  const excelProductIds = useMemo(() => {
    if (preview) {
      const ids = new Set<string>()
      preview.sheets.forEach((sheet) => {
        if (sheet.productId) ids.add(sheet.productId)
      })
      return ids
    }
    return new Set(usageProductIds)
  }, [usageProductIds, preview])

  /**
   * 오직 이 달 수불자료(엑셀)에 등장한 제품만 생산량을 받는다.
   * 엑셀을 올리기 전에는 제품관리에 등록된 제품이라도 보여주지 않는다 —
   * 그 달에 만들지도 않은 제품에 값을 넣는 일을 막는다.
   */
  const visibleRows = useMemo(
    () => rows.filter((row) => excelProductIds.has(row.id)),
    [rows, excelProductIds],
  )
  const isFilteredByExcel = excelProductIds.size > 0 && visibleRows.length < rows.length

  const hasRows = visibleRows.length > 0
  const filledCount = visibleRows.filter((row) => row.production.trim() !== '').length
  const allFilled = hasRows && filledCount === visibleRows.length

  // 저장된 값을 화면에 되불러올지. worker·재접속(freshEntry)은 빈 폼이지만,
  // 마감된 회차는 그와 무관하게 저장된 값을 읽기전용으로 보여준다.
  const loadSaved = !freshEntry || isLocked

  // setState 는 항상 await 뒤에서 일어나야 한다. periodId 가 없을 때도
  // Promise.resolve 를 거쳐 마이크로태스크로 미룬다 (이펙트 본문 동기 setState 금지)
  const reloadUsages = useCallback(async () => {
    const rows = await (periodId && loadSaved
      ? fetchMaterialUsages(periodId).catch((): UsageLine[] => [])
      : Promise.resolve<UsageLine[]>([]))
    // 제품 범위는 freshEntry 와 무관하게 항상 읽는다
    const ids = await (periodId
      ? fetchUsageProductIds(periodId).catch((): string[] => [])
      : Promise.resolve<string[]>([]))
    setUsages(rows)
    setUsageProductIds(ids)
  }, [periodId, loadSaved])

  const reloadHistory = useCallback(async () => {
    // 버킷·테이블이 없어도 입력 작업은 막지 않는다
    const rows = await (periodId && loadSaved
      ? fetchFileHistory({ periodId, limit: 10 }).catch((): FileHistoryItem[] => [])
      : Promise.resolve<FileHistoryItem[]>([]))
    setHistory(rows)
  }, [periodId, loadSaved])

  // 린터가 함수 경계를 넘어 비동기성을 추적하지 못하므로 async IIFE 로 감싼다
  useEffect(() => { void (async () => { await reloadUsages() })() }, [reloadUsages])
  useEffect(() => { void (async () => { await reloadHistory() })() }, [reloadHistory])

  /**
   * 표시할 월 목록 — 오늘 기준 최근 12개월을 **항상** 만든다.
   * DB 에 있는 회차만 보여주면 입력한 달만 띄엄띄엄 떠서 줄 수가 들쭉날쭉했다.
   * 회차가 없는 달은 아직 아무것도 입력하지 않은 것이므로 '미입력' 으로 둔다.
   */
  const monthChips = useMemo(() => {
    const statusByMonth = new Map(
      periods.map((p) => [p.period.slice(0, 7), p.status] as const),
    )
    const today = new Date()
    // 왼쪽이 가장 오래된 달, 오른쪽 끝이 이번 달 — 달력을 읽는 순서와 같다
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const status = statusByMonth.get(key)
      return {
        key,
        // '26년 8월' 형태. 두 자리 연도라 12칸이 한 줄에 들어간다
        label: `${String(d.getFullYear()).slice(2)}년 ${d.getMonth() + 1}월`,
        state: status === 'confirmed' ? 'locked' : status ? 'draft' : 'empty',
      } as const
    })
  }, [periods])

  // 월별 마감 여부 목록. admin 1단계(onPeriodChanged 있음)에서만 쓴다.
  // isLocked 가 바뀌면(=이 화면에서 마감/마감취소) 배지도 다시 읽는다.
  useEffect(() => {
    if (!onPeriodChanged) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchPeriods()
        if (!cancelled) setPeriods(rows)
      } catch (error) {
        console.error('[1단계] 월 회차 조회 실패', error)
        if (!cancelled) setPeriods([])
      }
    })()
    return () => { cancelled = true }
  }, [onPeriodChanged, isLocked, periodId])

  // §5-1 저장된 생산량을 제품 목록에 좌측 조인한다 (F-11).
  // 조인하지 않으면 아직 입력하지 않은 제품이 화면에서 사라진다.
  useEffect(() => {
    let cancelled = false
    const build = async () => {
      // worker·재접속은 빈 폼, 마감된 회차는 저장된 생산량을 되불러온다
      const saved = periodId && loadSaved ? await fetchProduction(periodId).catch(() => []) : []
      if (cancelled) return
      const byId = new Map(saved.map((s) => [s.productId, s] as const))
      setRows(products.map((product) => ({
        id: product.id,
        name: product.name,
        production: byId.has(product.id) ? String(byId.get(product.id)!.production) : '',
      })))
    }
    void build()
    return () => { cancelled = true }
  }, [periodId, products, loadSaved])

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const autoRegisterMissingProducts = async (source: SubulPreview, sourceFile: File) => {
    let matched = source

    if (matched.missingMaterials.length > 0) {
      const priceByName: Record<string, number> = {}
      matched.sheets.forEach((sheet) =>
        sheet.lines.forEach((line) => {
          if (!line.materialId) priceByName[line.materialName] = line.unitPrice
        }),
      )
      await createMissingMaterials(matched.missingMaterials, priceByName)
      matched = await previewSubul(sourceFile)
    }

    const count = await createMissingProducts(matched.sheets)
    await onProductsChanged?.()
    return { count, preview: await previewSubul(sourceFile) }
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

      // 9월 자료를 8월에 저장하는 실수를 잡는다. 확신이 없으므로 막지는 않는다.
      const guessed = monthFromFileName(picked.name)
      setMonthMismatch(guessed && guessed !== month ? guessed : null)

      // 여기서 제품을 자동으로 만들지 않는다.
      // 시트명 오타 하나가 그대로 새 제품이 됐고, 그 달을 마감하고 나면
      // 지울 수도 없었다 (마감된 달의 자료는 삭제가 막힌다 — ⑪).
      // 미매칭 목록을 보여주고 사람이 눌러 만들게 한다.
      const missing = result.missingProducts.length + result.missingMaterials.length
      onAction(
        result.errors.length > 0
          ? `읽지 못한 행이 ${result.errors.length}건 있습니다. 수량·단가 칸을 확인해주세요.`
          : missing > 0
            ? `${result.sheets.length}개 제품을 읽었습니다. 매칭되지 않은 항목이 있어 확인이 필요합니다.`
            : `${result.sheets.length}개 제품, ${result.readyCount}개 재료 행을 읽었습니다.`,
      )
    } catch (error) {
      onAction(`읽기 실패: ${describeDbError(error)}`)
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
      const count = preview.missingMaterials.length
      await createMissingMaterials(preview.missingMaterials, priceByName)

      // 방금 만든 재료가 매칭되도록 같은 파일을 다시 읽는다
      if (file) setPreview(await previewSubul(file))
      onAction(`원재료 ${count}개를 등록했습니다.`)
    } catch (error) {
      onAction(`등록 실패: ${describeDbError(error)}`)
    } finally {
      setBusy('')
    }
  }

  /**
   * 수불자료 시트명으로 제품을 만든다.
   * 파일을 다시 읽어 매칭 상태를 갱신하므로 사용자가 재업로드할 필요가 없다.
   */
  const registerMissingProducts = async () => {
    if (!preview || !file || preview.missingProducts.length === 0) return
    const names = preview.missingProducts
    setBusy('새 제품과 레시피를 자동 등록하는 중…')
    try {
      const registered = await autoRegisterMissingProducts(preview, file)
      setPreview(registered.preview)
      onAction(
        `새 제품과 레시피 ${registered.count}개를 자동 등록했습니다: ${names.join(', ')}. `
        + '판매가와 포장 단위는 제품 관리에서 입력해 주세요.',
      )
    } catch (error) {
      onAction(`제품 등록 실패: ${describeDbError(error)}`)
    } finally {
      setBusy('')
    }
  }

  /** §6-2 투입내역 저장 → §10-1·§10-2 원본 보관 */
  const commit = async () => {
    if (!preview || !periodId) return

    setBusy('투입내역을 저장하는 중…')
    let saved: number
    try {
      saved = await commitSubul(periodId, preview)
      markEntrySaved(periodId) // 저장 완료 → 재접속 시 빈 폼
      await reloadUsages()
    } catch (error) {
      setBusy('')
      onAction(`저장 실패: ${describeDbError(error)}`)
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
    setMonthMismatch(null)
    setBusy('')
  }

  /** §10-4 Private 버킷이라 60초짜리 서명 URL 을 발급받는다 */
  const download = async (item: FileHistoryItem) => {
    try {
      window.open(await createDownloadUrl(item.storage_path, 60), '_blank')
    } catch (error) {
      onAction(`다운로드 실패: ${describeDbError(error)}`)
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
      onAction(`삭제 실패: ${describeDbError(error)}`)
    }
  }

  /** §5-2 생산량 저장 */
  const persistProduction = async () => {
    if (!periodId) return false
    try {
      // 화면에 보이는 제품만 저장한다. 숨겨진 제품까지 0 으로 덮어쓰면
      // 다른 경로로 들어간 생산량이 지워진다.
      await saveProduction(periodId, visibleRows.map((row) => ({
        productId: row.id,
        production: row.production,
      })))
      markEntrySaved(periodId) // 저장 완료 → 재접속 시 빈 폼
      return true
    } catch (error) {
      onAction(`저장 실패: ${describeDbError(error)}`)
      return false
    }
  }

  const saveDraft = async () => {
    if (await persistProduction()) onAction('제품 생산량을 임시 저장했습니다.')
  }

  const goToNextStep = async () => {
    // 모든 제품에 생산량이 있어야 다음 단계로 넘어간다.
    // 하나라도 비면 그 제품의 원가가 조용히 0 으로 확정된다.
    const empty = visibleRows.filter((row) => row.production.trim() === '')
    if (empty.length > 0) {
      onAction(`생산량을 입력하지 않은 제품이 ${empty.length}개 있습니다. 모두 입력해주세요.`)
      return
    }
    if (await persistProduction()) onNavigate('data-entry-2')
  }

  /**
   * 마감된 회차를 1단계에서 바로 풀어 값을 고칠 수 있게 한다.
   * (원래 3단계에 있던 '마감 취소' 기능을 옮겨온 것)
   */
  const runReopen = async () => {
    if (!periodId) return
    setBusy('마감을 취소하는 중…')
    try {
      await reopenPeriod(periodId)
      // 재접속 후 마감 회차는 빈 폼(freshEntry)으로 열린다. 수정하려면
      // 저장된 생산량·투입내역을 화면에 되불러와야 한다.
      // reloadUsages/History 는 freshEntry 면 빈 배열을 주므로 여기서 직접 읽는다
      const [saved, usageRows, fileRows] = await Promise.all([
        fetchProduction(periodId).catch(() => []),
        fetchMaterialUsages(periodId).catch((): UsageLine[] => []),
        fetchFileHistory({ periodId, limit: 10 }).catch((): FileHistoryItem[] => []),
      ])
      const byId = new Map(saved.map((s) => [s.productId, s] as const))
      setRows((current) => current.map((row) => ({
        ...row,
        production: byId.has(row.id) ? String(byId.get(row.id)!.production) : row.production,
      })))
      setUsages(usageRows)
      setHistory(fileRows)
      onPeriodChanged?.()
      onAction('마감을 취소했습니다. 값을 고친 뒤 다시 계산하세요.')
    } catch (error) {
      onAction(`마감 취소 실패: ${describeDbError(error)}`)
    } finally {
      setBusy('')
    }
  }

  /**
   * 현재 입력값으로 원가를 다시 계산하고 그 달을 마감한다.
   * (원래 3단계의 '다시 계산/원가 계산' 버튼) 계산 전 생산량이 상식적인지 대조한다.
   */
  const runConfirm = async () => {
    if (!periodId) return
    // 화면에 입력한 생산량을 먼저 저장해야 계산에 반영된다
    if (!(await persistProduction())) return
    setBusy('원가를 계산하는 중…')
    try {
      const [usageTotals, savedProductions, operatingCosts] = await Promise.all([
        fetchUsageTotals(periodId).catch(() => []),
        fetchProduction(periodId).catch(() => []),
        fetchOperatingCosts(periodId).catch(() => []),
      ])

      // 비어 있는 값이 있으면 아예 막는다. 마감 뒤에는 손대기 어렵다
      const blockers = findConfirmBlockers(
        savedProductions,
        usageTotals,
        products.map((product) => ({
          productId: product.id,
          unitMaterialCost: product.materialCost,
        })),
        operatingCosts.flatMap((cost) => cost.allocations),
        operatingCosts.some((cost) => cost.allocationBasis === 'material_cost'),
      )
      if (blockers.length > 0) {
        window.alert(describeBlockers(blockers))
        setBusy('')
        return
      }

      const issues = findProductionIssues(usageTotals, savedProductions)
      const proceed = issues.length > 0
        ? window.confirm(describeIssues(issues))
        : window.confirm(
            `${month.replace('-', '년 ')}월 원가를 계산하고 마감합니다.\n`
            + '마감하면 입력이 잠깁니다. 값을 고치려면 마감을 취소해야 합니다.\n\n계속할까요?',
          )
      if (!proceed) { setBusy(''); return }

      const count = await confirmPeriod(periodId)
      onPeriodChanged?.()
      onAction(
        count > 0
          ? `${count}개 제품의 원가를 계산했습니다.`
          : '계산할 데이터가 없습니다. 생산량을 먼저 입력해주세요.',
      )
    } catch (error) {
      onAction(`계산 실패: ${describeDbError(error)}`)
    } finally {
      setBusy('')
    }
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
          </div>
          <div className="entry-heading__actions">
            {onPeriodChanged && (
              isLocked ? (
                <button
                  className="workflow-outline-button entry-reopen-button"
                  type="button"
                  disabled={Boolean(busy) || !periodId}
                  onClick={() => void runReopen()}
                >
                  <Icon name="unlock" size={15} /> 마감 풀고 수정
                </button>
              ) : (
                <button
                  className="workflow-outline-button"
                  type="button"
                  disabled={Boolean(busy) || !periodId}
                  onClick={() => void runConfirm()}
                >
                  <Icon name="check" size={16} /> 마감
                </button>
              )
            )}
            <label className="entry-month-picker">
              <span className="visually-hidden">기준 월</span>
              <Icon name="calendar" size={17} />
              <input
                type="month"
                value={month}
                onChange={(event) => onMonthChange(event.target.value)}
              />
            </label>
          </div>
        </header>

        {/* 캘린더를 열지 않아도 늘 보인다. 최근 12개월이 한 줄에 들어간다 */}
        {onPeriodChanged && (
          <div className="entry-month-chips is-open">
            <div className="entry-month-chips__inner" role="list" aria-label="월별 마감 상태">
              {monthChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  role="listitem"
                  className={`entry-month-chip is-${chip.state}${chip.key === month ? ' is-current' : ''}`}
                  title={
                    chip.state === 'locked' ? '마감됨'
                      : chip.state === 'draft' ? '작성중'
                        : '아직 입력하지 않은 달'
                  }
                  onClick={() => onMonthChange(chip.key)}
                >
                  <span className="entry-month-chip__dot" aria-hidden="true" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
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
                disabled={Boolean(busy)}
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
                <span
                  className={`subul-preview__badge${
                    preview.errors.length ? ' is-error' : unmatched ? ' is-warn' : ' is-ok'
                  }`}
                >
                  {preview.errors.length
                    ? `오류 ${preview.errors.length}건`
                    : unmatched ? `미매칭 ${unmatched}건` : `${preview.readyCount}행 저장 가능`}
                </span>
              </header>

              {/* 파일명의 월과 선택한 월이 다르다. 다른 달에 저장되는 사고를 막는다 */}
              {monthMismatch && (
                <div className="subul-preview__month-warning">
                  <p>
                    <strong>파일명은 {monthMismatch.replace('-', '년 ')}월 자료로 보입니다.</strong>
                    <br />
                    지금 선택된 기준 월은 {month.replace('-', '년 ')}월입니다. 이대로 저장하면
                    {' '}{month.replace('-', '년 ')}월 자료로 기록됩니다.
                  </p>
                  <button
                    type="button"
                    className="workflow-outline-button"
                    onClick={() => {
                      onMonthChange(monthMismatch)
                      setMonthMismatch(null)
                    }}
                  >
                    {monthMismatch.replace('-', '년 ')}월로 바꾸기
                  </button>
                </div>
              )}

              {/* 값이 있는데 해석하지 못한 행. 고치기 전에는 저장할 수 없다 */}
              {preview.errors.length > 0 && (
                <div className="subul-preview__errors">
                  <p>
                    <strong>엑셀에서 읽지 못한 행이 {preview.errors.length}건 있습니다.</strong>
                    <br />
                    수량 칸에는 숫자만 넣어주세요. 단위는 kg 기준이며, g·톤은 자동 환산됩니다.
                    개·박스처럼 개수를 세는 단위는 kg 으로 바꿀 수 없어 저장할 수 없습니다.
                  </p>
                  <ul>
                    {preview.errors.map((message) => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              )}

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
                <div className="subul-preview__missing">
                  <p>
                    <strong>등록되지 않은 제품:</strong> {preview.missingProducts.join(', ')}
                    <br />
                    <strong>시트명에 오타가 없는지 먼저 확인하세요.</strong> 이름이 한 글자만 달라도
                    다른 제품으로 새로 등록됩니다. 등록한 뒤 그 달을 마감하면 지울 수 없습니다.
                    <br />엑셀을 고쳐서 다시 올리거나, 정말 새 제품이면 아래 버튼으로 등록하세요.
                  </p>
                  <button
                    type="button"
                    className="workflow-outline-button"
                    disabled={Boolean(busy)}
                    onClick={() => void registerMissingProducts()}
                  >
                    새 제품으로 등록하기
                  </button>
                </div>
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
                disabled={
                  preview.readyCount === 0 || preview.errors.length > 0 || unmatched > 0
                  || !periodId || Boolean(busy)
                }
                onClick={commit}
              >
                {preview.errors.length > 0
                  ? '오류를 수정한 뒤 다시 올려주세요'
                  : unmatched > 0
                    ? '미매칭 항목을 먼저 등록해 주세요'
                  : <>투입내역 {preview.readyCount}행 저장 · 원본 보관 <Icon name="check" size={16} /></>}
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
                  <span className="production-list__count">{visibleRows.length}개 제품</span>
                </div>
                <div className="production-list__meta">
                  <p>
                    수불자료에는 생산량이 없습니다. 생산 일지를 보고 직접 입력하세요.
                    {' '}
                    <strong>불량은 빼고 양품만</strong> 넣어야 합니다 — 총 생산량을 넣으면 단위원가가 실제보다 낮게 나옵니다.
                    {isFilteredByExcel && ' 이 달 수불자료에 있는 제품만 표시합니다.'}
                  </p>
                  <span className="production-list__progress">
                    입력 완료 <strong>{filledCount}</strong> / {visibleRows.length}
                  </span>
                </div>
              </header>

              <div className="production-list__labels" aria-hidden="true">
                <span>제품명</span>
                <span>생산량(kg)</span>
              </div>

              <div className="production-list__rows">
                {visibleRows.map((row) => {
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
                            disabled={isLocked}
                            onValueChange={(raw) => updateRow(row.id, { production: raw })}
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
              {rows.length === 0 ? (
                <>
                  <p>등록된 제품이 없습니다</p>
                  <span>수불자료를 올리면 제품을 바로 등록할 수 있습니다.</span>
                </>
              ) : (
                <>
                  <p>이 달 수불자료에 매칭된 제품이 없습니다</p>
                  <span>엑셀을 올리고 미매칭 제품을 등록하면 생산량 입력칸이 나타납니다.</span>
                </>
              )}
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
              disabled={!allFilled || !periodId || isLocked}
              title={isLocked ? '마감된 회차입니다. 수정하려면 마감을 취소하세요.' : (!allFilled ? '모든 제품의 생산량을 입력해주세요.' : undefined)}
            >
              다음 단계: 제조 공정 입력 <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
