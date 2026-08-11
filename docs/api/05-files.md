[← 목차](../API.md)

# 05. 파일 (엑셀 원본 보관 · 업로드 이력)

대상 테이블: `file_uploads`
대상 Storage: `excel-uploads` (Private)
대상 화면: 데이터 입력 1단계, 파일 이력

엑셀 파싱 자체는 클라이언트가 한다([§12](01-frontend.md#12-엑셀-업로드-파이프라인)). DB에는 **원본 보관**과 **업로드 이력**만 남긴다.

| 기능 | 대상 |
|---|---|
| [§10-1](#10-1-원본-업로드) 원본 업로드 | Storage |
| [§10-2](#10-2-이력-기록) 이력 기록 | `file_uploads` |
| [§10-3](#10-3-이력-목록-조회) 이력 목록 조회 | `file_uploads` |
| [§10-4](#10-4-원본-다운로드) 원본 다운로드 | Storage |
| [§10-5](#10-5-삭제) 삭제 | Storage + `file_uploads` |

---

## §10-1. 원본 업로드 ✔️ `Storage`

```ts
const safeName = (n: string) => n.replace(/[^\w.\-]/g, '_')
const path = `${periodId}/${Date.now()}-${safeName(file.name)}`

const { error } = await supabase.storage
  .from('excel-uploads')
  .upload(path, file, { upsert: false })
```

필수:

* `file`
* `path`

필드:

```
path    {periodId}/{timestamp}-{safeFileName} 형식 권장
bucket  excel-uploads. Private 이어야 한다 (원본 생산 데이터)
```

동작:

```
1. Storage 에 binary 를 저장한다.
2. 경로에 한글이 들어가면 안 된다. 원본 파일명은 §10-2 의 original_name 에 보존한다.
3. Private 버킷이므로 getPublicUrl 이 아니라 createSignedUrl 로 다운로드한다 (§10-4).
4. 검증(§12-3)을 통과한 뒤에만 업로드한다. 실패한 파일이 쌓이면 이력이 지저분해진다.
```

error:

```json
{ "statusCode": "409", "error": "Duplicate", "message": "The resource already exists" }
{ "statusCode": "404", "error": "Bucket not found" }
```

---

## §10-2. 이력 기록 ✔️

```ts
const { data, error } = await supabase
  .from('file_uploads')
  .insert({
    period_id:     periodId,
    bucket:        'excel-uploads',
    storage_path:  path,
    original_name: file.name,
    file_name:     displayName,
    description,
    file_type:     file.type,
    size:          file.size,
    row_count:     result.productCount + result.usageCount,
  })
  .select()
  .single()
```

필수:

* `storage_path`
* `original_name`

옵션:

* `period_id` `bucket` `file_name` `description` `file_type` `size` `row_count` `uploaded_by`

필드:

```
storage_path  unique. §10-1 에서 쓴 path 와 동일해야 한다
original_name 업로드 원본 파일명 (한글 포함 가능)
file_name     사용자가 보는 명칭
row_count     SheetJS 로 파싱한 행 수. 검증용
```

동작:

```
1. Storage 업로드가 성공한 뒤에 호출한다.
2. storage_path 가 unique 이므로 같은 파일을 두 번 기록할 수 없다.
3. Storage 와 이 테이블은 자동 연동되지 않는다. 삭제 시 양쪽 모두 지워야 한다 (§10-5).
```

data:

```json
{
  "id": "aa11…",
  "period_id": "9c1e…",
  "bucket": "excel-uploads",
  "storage_path": "9c1e…/1784648167178-production.xlsx",
  "original_name": "2026년 8월 생산실적.xlsx",
  "file_name": "8월 생산실적",
  "file_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size": 198505,
  "row_count": 42,
  "uploaded_at": "2026-08-09T04:36:13.145Z"
}
```

error:

```json
{ "code": "23505", "message": "duplicate key value violates unique constraint \"file_uploads_storage_path_key\"" }
```

---

## §10-3. 이력 목록 조회 ✔️

```ts
const { data, error } = await supabase
  .from('file_uploads')
  .select('id, storage_path, original_name, file_name, description, file_type, size, row_count, uploaded_at, cost_periods(period)')
  .order('uploaded_at', { ascending: false })
  .range(0, 99)
```

필수:

* 없음

옵션:

* `.eq('period_id', periodId)` — 특정 월만
* `.range(offset, offset + limit - 1)` — 페이지네이션

data:

```json
[
  { "id": "aa11…", "original_name": "2026년 8월 생산실적.xlsx",
    "file_name": "8월 생산실적", "size": 198505, "row_count": 42,
    "uploaded_at": "2026-08-09T04:36:13.145Z",
    "cost_periods": { "period": "2026-08-01" } }
]
```

---

## §10-4. 원본 다운로드 ✔️ `Storage`

Private 버킷이라 서명 URL을 발급받아야 한다.

```ts
const { data, error } = await supabase.storage
  .from('excel-uploads')
  .createSignedUrl(storagePath, 60)      // 60초 유효

window.open(data.signedUrl)
```

필수:

* `storagePath`
* 만료 시간(초)

동작:

```
1. 만료 시간이 지나면 링크가 죽는다. 미리 발급해 두지 않는다.
2. 파일이 없으면 error 가 온다. data.signedUrl 접근 전에 확인한다.
```

---

## §10-5. 삭제 ✔️

Storage와 테이블 **양쪽 모두** 지워야 한다. 한쪽만 지우면 고아 레코드나 고아 파일이 남는다.

```ts
await supabase.storage.from('excel-uploads').remove([storagePath])
await supabase.from('file_uploads').delete().eq('id', fileId)
```

필수:

* `storagePath`
* `fileId`

---

[← 04-results](04-results.md) · [목차](../API.md) · [다음: 06-users →](06-users.md)
