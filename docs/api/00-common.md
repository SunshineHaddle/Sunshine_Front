[← 목차](../API.md)

# 00. 공통

## §0-1. 클라이언트 설정

```bash
npm install @supabase/supabase-js
```

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

```
# .env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

> `.env`는 `.gitignore`에 있어야 한다. anon key는 브라우저에 노출되는 게 정상이지만, 커밋 이력에 남기지는 않는다.

## §0-2. 타입 생성

타입은 손으로 쓰지 않고 DB에서 생성한다. 스키마를 바꾸면 다시 실행한다.

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
```

## §0-3. 응답 규약

모든 호출은 `{ data, error }`를 반환한다. **`error`는 throw되지 않으므로 매번 확인해야 한다.**

```ts
const { data, error } = await supabase.from('products').select('*')
if (error) { /* 처리 */ }
```

| 상황 | `data` | `error` |
|---|---|---|
| 정상 | 배열 또는 객체 | `null` |
| 실패 | `null` | 에러 객체 |
| **RLS 차단** | **`[]`** | **`null`** |

마지막 행이 가장 헷갈리는 지점이다. 에러가 안 났는데 데이터가 비어 있으면 §0-5를 확인한다.

## §0-4. 에러 코드

| 코드 | 원인 | 대응 |
|---|---|---|
| `PGRST116` | `.single()`인데 0행 또는 2행 이상 | `.maybeSingle()`로 변경 |
| `23505` | unique 위반 | `upsert` + `onConflict` 사용 |
| `23503` | FK 위반 (없는 `product_id` 등) | 참조 대상 먼저 생성 |
| `22P02` | 빈 문자열을 숫자·enum 컬럼에 전송 | `Number(v) \|\| 0` 변환 |
| `22007` | `'2026-08'`을 date 컬럼에 전송 | `'2026-08-01'`로 변환 (F-10) |
| `42501` | 뷰 권한 없음 | `grant select on <view>` |
| `409 Duplicate` | Storage 같은 경로 중복 | `upsert: true` 또는 경로에 timestamp |
| `404 Bucket not found` | 버킷 미생성 | Storage에서 버킷 생성 |
| **error 없이 `[]`** | **RLS 차단** | §0-5 |

## §0-5. RLS (개발 중 임시 권한)

로그인이 하드코딩된 상태에서는 브라우저가 `anon` 신분이라 모든 조회가 빈 배열로 온다. 개발 중에는 임시 정책이 필요하다.

```sql
-- 개발용 임시 허용
do $$
declare t text;
begin
  foreach t in array array[
    'materials','products','recipe_items','material_usages','cost_periods',
    'production_records','operating_costs','operating_cost_allocations',
    'product_cost_summaries','file_uploads'
  ] loop
    execute format('drop policy if exists "dev anon all" on %I', t);
    execute format('create policy "dev anon all" on %I for all to anon
                    using (true) with check (true)', t);
  end loop;
end $$;
```

**배포 전 반드시 제거한다.** anon key는 빌드된 JS에 그대로 박히므로, 이 정책이 남아 있으면 누구나 DB를 읽고 쓸 수 있다.

```sql
do $$
declare t text;
begin
  foreach t in array array[
    'materials','products','recipe_items','material_usages','cost_periods',
    'production_records','operating_costs','operating_cost_allocations',
    'product_cost_summaries','file_uploads'
  ] loop
    execute format('drop policy if exists "dev anon all" on %I', t);
  end loop;
end $$;
```

## §0-6. 뷰 권한

뷰에는 RLS를 걸 수 없어 `GRANT`로 처리한다. `42501`이 나면 한 번 실행한다.

```sql
grant select on v_product_recipe_cost, v_cost_trend_monthly to anon, authenticated;
```

## §0-7. Storage 버킷

| 버킷 | Public | 용도 | 접근 |
|---|---|---|---|
| `product-images` | ✅ | 제품 대표 이미지 | `getPublicUrl` |
| `excel-uploads` | ❌ | 엑셀 원본 보관 | `createSignedUrl` |

Storage 경로에는 **한글을 넣지 않는다.** 원본 파일명은 DB 컬럼에 보존한다.

---

[← 목차](../API.md) · [다음: 01-frontend →](01-frontend.md)
