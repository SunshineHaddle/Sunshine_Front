const DATA_ENTRY_LOG_KEY = 'sunshine.data-entry-log.v1'

export type DataEntryCompletion = {
  account: string
  completedAt: string
}

export function recordDataEntryCompletion(account: string) {
  const entry: DataEntryCompletion = { account, completedAt: new Date().toISOString() }
  let log: DataEntryCompletion[] = []
  try {
    log = JSON.parse(window.localStorage.getItem(DATA_ENTRY_LOG_KEY) ?? '[]') as DataEntryCompletion[]
  } catch {
    log = []
  }
  log.push(entry)
  window.localStorage.setItem(DATA_ENTRY_LOG_KEY, JSON.stringify(log))
}

export function loadLatestCompletion(account: string): DataEntryCompletion | null {
  try {
    const log = JSON.parse(window.localStorage.getItem(DATA_ENTRY_LOG_KEY) ?? '[]') as DataEntryCompletion[]
    const matched = log.filter((item) => item.account === account)
    return matched.length > 0 ? matched[matched.length - 1] : null
  } catch {
    return null
  }
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
