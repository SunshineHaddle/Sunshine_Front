const DATA_ENTRY_LOG_KEY = 'sunshine.data-entry-log.v1'

export type DataEntryCompletion = {
  id: string
  account: string
  completedAt: string
}

function readLog(): DataEntryCompletion[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DATA_ENTRY_LOG_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `legacy-${index}-${String(item.completedAt ?? '')}`,
        account: typeof item.account === 'string' ? item.account : '',
        completedAt: typeof item.completedAt === 'string' ? item.completedAt : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

function writeLog(log: DataEntryCompletion[]) {
  window.localStorage.setItem(DATA_ENTRY_LOG_KEY, JSON.stringify(log))
}

export function recordDataEntryCompletion(account: string) {
  const entry: DataEntryCompletion = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `entry-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    account,
    completedAt: new Date().toISOString(),
  }
  const log = readLog()
  log.push(entry)
  writeLog(log)
}

export function loadLatestCompletion(account: string): DataEntryCompletion | null {
  const matched = readLog().filter((item) => item.account === account)
  return matched.length > 0 ? matched[matched.length - 1] : null
}

export function loadCompletionHistory(account?: string): DataEntryCompletion[] {
  const log = readLog()
  const filtered = account ? log.filter((item) => item.account === account) : log
  return [...filtered].sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}

export function revertToCompletion(id: string) {
  const log = readLog()
  const target = log.find((item) => item.id === id)
  if (!target) return

  const kept = log.filter((item) => item.completedAt <= target.completedAt)
  writeLog(kept)
}

export function formatCompletionTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
