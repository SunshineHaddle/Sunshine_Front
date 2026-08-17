/** §10 — 엑셀 원본 보관 / 업로드 이력 */
import { supabase } from '../supabase'
import { num, type FileUploadRow } from '../types'
import { getSessionUserId } from './auth'

const BUCKET = 'excel-uploads'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Storage 경로에는 한글이 들어가면 안 된다. 원본명은 DB 에 보존한다. */
export const toStoragePath = (periodId: string, fileName: string) =>
  `${periodId}/${Date.now()}-${fileName.replace(/[^\w.-]/g, '_')}`

// ── §10-1 + §10-2. 원본 업로드 + 이력 기록 ──────────────────
export async function uploadExcel(input: {
  periodId: string
  file: File
  displayName?: string
  description?: string
  rowCount?: number
}): Promise<FileUploadRow> {
  const path = toStoragePath(input.periodId, input.file.name)

  const { error } = await supabase.storage.from(BUCKET).upload(path, input.file)
  if (error) throw new Error(error.message)

  // 누가 올렸는지 남긴다. 사용자 관리 화면의 입력 이력이 이 값을 읽는다.
  const uploaderId = await getSessionUserId()

  return unwrap(
    await supabase
      .from('file_uploads')
      .insert({
        period_id: input.periodId,
        uploaded_by: uploaderId,
        bucket: BUCKET,
        storage_path: path,
        original_name: input.file.name,
        file_name: input.displayName ?? null,
        description: input.description ?? null,
        file_type: input.file.type || null,
        size: input.file.size,
        row_count: input.rowCount ?? null,
      })
      .select()
      .single(),
  ) as FileUploadRow
}

// ── §10-3. 이력 목록 조회 ───────────────────────────────────
export type FileHistoryItem = FileUploadRow & {
  period: string | null
  /** 업로더 표시명. profiles 행이 없거나 예전 데이터면 null */
  uploaderName: string | null
  uploaderLoginId: string | null
}

export async function fetchFileHistory(options?: {
  periodId?: string
  /** 특정 사용자가 올린 것만 */
  uploadedBy?: string
  offset?: number
  limit?: number
}): Promise<FileHistoryItem[]> {
  const offset = options?.offset ?? 0
  const limit = options?.limit ?? 100

  let query = supabase
    .from('file_uploads')
    .select(
      'id, period_id, bucket, storage_path, original_name, file_name, description,' +
        ' file_type, size, row_count, uploaded_by, uploaded_at,' +
        ' cost_periods(period), profiles(name, login_id)',
    )
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.periodId) query = query.eq('period_id', options.periodId)
  if (options?.uploadedBy) query = query.eq('uploaded_by', options.uploadedBy)

  const rows = unwrap(await query) as unknown as (FileUploadRow & {
    cost_periods: { period: string } | null
    profiles: { name: string; login_id: string } | null
  })[]

  return rows.map((row) => ({
    ...row,
    size: num(row.size),
    period: row.cost_periods?.period ?? null,
    uploaderName: row.profiles?.name ?? null,
    uploaderLoginId: row.profiles?.login_id ?? null,
  }))
}

// ── §10-4. 원본 다운로드 (Private 버킷이라 서명 URL) ─────────
export async function createDownloadUrl(storagePath: string, expiresInSec = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSec)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ── §10-5. 삭제 (Storage + 테이블 양쪽) ─────────────────────
export async function deleteFile(fileId: string, storagePath: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new Error(error.message)
  unwrap(await supabase.from('file_uploads').delete().eq('id', fileId))
}
