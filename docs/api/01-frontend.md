[← 목차](../API.md)

# 01. 프론트엔드 전담 처리

DB 호출이 아니라 클라이언트에서 처리하는 항목들. **별도 API를 만들지 않는다.**

| # | 기능 | 방식 | 화면 |
|---|---|---|---|
| [F-1](#f-1-환율-조회) | 환율 조회 | 외부 API `fetch` | 환율 산출 |
| [F-2](#f-2-pdf-생성) | PDF 생성 | `pdfmake` | 결과 확인, 대시보드 |
| [F-3](#f-3-엑셀-파싱) | 엑셀 파싱 | `SheetJS(xlsx)` | 1단계 |
| [F-4](#f-4-재료비재료-개수-합산) | 재료비·재료 개수 합산 | `reduce` | 제품 관리·상세 |
| [F-5](#f-5-인건비--금액-환산) | 인건비 % → 금액 환산 | 계산 후 저장 | 2단계 |
| [F-6](#f-6-배분-비율-100-검증) | 배분 비율 100% 검증 | 기존 로직 유지 | 2단계 |
| [F-7](#f-7-균등-분배) | 균등 분배 | 기존 로직 유지 | 2단계 |
| [F-8](#f-8-판매가현지가-계산) | 판매가·현지가 계산 | 계산 | 환율 산출 |
| [F-9](#f-9-원가-미리보기) | 원가 미리보기 | 계산 | 제품 생성 |
| [F-10](#f-10-월-문자열-변환) | 월 문자열 변환 | 문자열 처리 | 데이터 입력 전체 |
| [F-11](#f-11-미입력-제품-행-병합) | 미입력 제품 행 병합 | 좌측 조인 | 1단계 |
| [F-12](#f-12-숫자통화-포맷) | 숫자·통화 포맷 | `Intl.NumberFormat` | 전체 |
| [F-13](#f-13-권한별-라우팅-가드) | 권한별 라우팅 가드 | 기존 로직 유지 | 전체 |
| [F-14](#f-14-차트-축-라벨) | 차트 축 라벨 | 계산 | 대시보드 |

---

## F-1. 환율 조회

`exchange_rates` 테이블은 두지 않는다. `ExchangeRateCalculatorPage.currencySettings`의 `flag` `label` `symbol` `fractionDigits`는 표시용 상수로 그대로 두고, **`rate`만 외부 API 응답으로 교체**한다.

```ts
const res  = await fetch(EXCHANGE_API_URL)
const json = await res.json()
const rates = { USD: json.USD, JPY: json.JPY, EUR: json.EUR, CNY: json.CNY }
```

## F-2. PDF 생성

DB에서 확정 스냅샷을 조회한 뒤([§8-2](04-results.md#8-2-결과--수익성-조회)) 그 결과로 문서를 만든다. 서버 렌더링이나 별도 추출 API는 없다.

```ts
const { data } = await supabase.from('product_cost_summaries').select(/* … */)
pdfMake.createPdf(buildDocDefinition(data)).download(`원가분석_${month}.pdf`)
```

## F-3. 엑셀 파싱

파싱은 클라이언트에서 하고, DB에는 **파싱 결과**와 **원본 파일 이력**만 남긴다. 양식과 전체 코드는 §12.

```
1. SheetJS 로 파일을 읽어 시트를 JSON 배열로 변환한다.      → §12-1
2. 제품코드·재료코드를 uuid 로 매핑한다.                     → §12-2
3. 없는 코드가 있으면 저장하지 않고 목록을 보여준다.          → §12-3
4. 원본 파일을 Storage(excel-uploads)에 업로드한다.        → §10-1
5. file_uploads 에 메타데이터를 기록한다.                    → §10-2
6. production_records / material_usages 에 저장한다.      → §5-2, §6-2
```

## F-4. 재료비·재료 개수 합산

`materialCost`와 `ingredientCount`는 DB 컬럼이 아니다. 중첩 조회 결과에서 만든다.

```ts
const products = data?.map(p => ({
  ...p,
  materialCost:    p.recipe_items.reduce((s, i) => s + Number(i.amount), 0),
  ingredientCount: p.recipe_items.length,
}))
```

## F-5. 인건비 % → 금액 환산

DB의 원가 계산은 `share_percent`가 아니라 `amount`만 참조한다. 저장 전에 환산한다.

```ts
amount: (totalAmount * (Number(pct) || 0)) / 100
```

## F-6. 배분 비율 100% 검증

`OperatingCostEntryPage.isLaborShareValid` 로직을 그대로 유지한다. DB 트리거로도 막을 수 있지만, 입력 중 실시간 피드백은 클라이언트에서만 가능하다.

## F-7. 균등 분배

`equalizeProductFees` 그대로 유지. 순수 계산이라 DB와 무관하다.

## F-8. 판매가·현지가 계산

```ts
const salePrice  = cost * (1 + marginRate / 100)
const localPrice = salePrice / rates[currency]
```

## F-9. 원가 미리보기

제품 생성 화면에서 재료를 담을 때 실시간으로 보여주는 값. 아직 DB에 저장되지 않은 상태라 클라이언트 계산이다.

```ts
const totalMaterialCost = selected.reduce((s, i) => s + i.unitPrice * i.usage, 0)
```

## F-10. 월 문자열 변환

화면 state는 `'2026-08'`, DB `date` 컬럼은 `'2026-08-01'`. 변환하지 않으면 `22007` 에러가 난다.

```ts
const period = `${month}-01`          // 저장할 때
const month  = period.slice(0, 7)     // 화면에 표시할 때
```

## F-11. 미입력 제품 행 병합

`production_records`는 **입력한 제품만** 반환한다. 그대로 렌더링하면 아직 입력 안 한 제품이 화면에서 사라진다. 제품 목록을 기준으로 좌측 조인해야 한다.

```ts
const byProduct = new Map(records.map(r => [r.product_id, r]))
const rows = products.map(p => ({
  id:         p.id,
  name:       p.name,
  production: byProduct.get(p.id)?.production_qty ?? '',
}))
```

## F-12. 숫자·통화 포맷

`formatWon`, `Intl.NumberFormat('ko-KR')` 기존 유틸 그대로 유지한다. DB는 `numeric`을 문자열로 줄 수 있으므로 `Number()`로 감싼다.

## F-13. 권한별 라우팅 가드

`workerAllowedRoutes` 로직 유지. 로그인 후 [§11-3](06-users.md#11-3-내-프로필-조회)으로 `role`을 조회해 분기한다.

| `profiles.role` | 접근 |
|---|---|
| `admin` | 전체 |
| `entry` | 데이터 입력 1·2단계 |
| `reviewer` | 조회 전용 |

## F-14. 차트 축 라벨

뷰는 `period`를 `'2026-01-01'`로 준다. `CostPoint.label`은 여기서 만든다.

```ts
const label = `${Number(period.slice(5, 7))}월`
```

---

# §12. 엑셀 업로드 파이프라인

현장에서 쓰는 **수불자료 장부 양식을 그대로** 받는다. 장부에 제품코드·재료코드 열이 없으므로 **한글 이름으로 매칭**한다. 이름 매칭은 오타에 약하므로 저장 전에 미매칭 목록을 화면에 보여주는 2단계(preview → commit) 구조를 쓴다.

구현: [`src/lib/excel/parseSubul.ts`](../../src/lib/excel/parseSubul.ts), [`src/lib/api/importSubul.ts`](../../src/lib/api/importSubul.ts)

## §12-1. 수불자료 양식

실제 파일(`수불자료.xlsx`, `수불자료_26.08.xlsx`)로 검증한 구조다.

```
시트 '포기김치'          ← 시트 이름이 곧 제품명
  1행  포기김치 — 수불 자료 전사     (제목)
  2행  원본: 수불.pdf …             (비고, 없을 수도 있음)
  4행  품명 | 수량(kg) | 단가(원) | 금액(원)    ← 헤더
  5행  배추 | 696948 | 865.51 | 603215463
  …
 19행  합계 |      |        | 1030504781      ← 여기서 종료

시트 '맛김치'            ← 제품마다 시트 하나
시트 '업로드_템플릿'      ← 이름에 '템플릿' 이 있으면 건너뜀
```

| 열 | 헤더 | 필수 | 용도 |
|---|---|---|---|
| A | `품명` | ✅ | `materials.name` 과 이름 매칭 |
| B | `수량(kg)` | ✅ | `material_usages.usage_qty` |
| C | `단가(원)` | ✅ | `material_usages.unit_price` |
| D | `금액(원)` | | **읽기만 함.** 저장하지 않음 |

파서가 흡수하는 변형:

```
1. 헤더 행 위치       — '품명' 이 있는 행을 15행까지 탐색 (파일마다 3행/4행으로 다름)
2. 헤더 이름 변형     — '품명'='품목'='재료명', '수량'='사용량'='투입량' (괄호·공백 무시)
3. 종료 행           — '합계' | '계' | '총계'
4. 템플릿 빈 자리     — '품명 작성' 행, 수량·단가가 모두 빈 행은 건너뜀
5. 숫자 표기         — '1,234.5' '₩1234' '1 234' 모두 허용
```

> **금액 열은 저장하지 않는다.** DB의 `amount` 는 generated 컬럼이라 `수량 × 단가` 로 다시 계산된다. 수불자료는 손글씨 전사본이라 장부 금액이 틀린 경우가 있는데(`수불자료.xlsx` 포기김치는 249만원 차이), 이 설계 덕분에 DB 값은 항상 정합이다. 차이는 `findAmountMismatches()` 로 확인해 화면에 경고로 띄운다.

> **생산량은 이 파일에 없다.** 수불자료는 원재료 투입 내역만 담는다. 제품별 생산량과 불량률은 화면에서 직접 입력해야 한다(§5-2).

## §12-2. 코드 → uuid 매핑 조회 ✔️

파싱한 코드를 한 번에 조회해 uuid로 바꾼다.

```ts
const { data: products, error } = await supabase
  .from('products').select('id, sku').in('sku', skus)

const { data: materials } = await supabase
  .from('materials').select('id, code').in('code', codes)
```

필수:

* `skus` / `codes` — **빈 배열이면 호출하지 않는다.** `in.()`는 문법 오류가 난다

동작:

```
1. 중복을 제거한 코드 배열로 한 번에 조회한다. 행마다 호출하지 않는다.
2. .in() 은 쿼리스트링으로 나가므로 URL 길이 제한이 있다.
   코드가 200개를 넘으면 나눠서 호출한다.
3. 결과를 Map 으로 만들어 O(1) 로 조회한다.
```

data:

```json
[ { "id": "11aa…", "sku": "SKU-2024-001" }, { "id": "22bb…", "sku": "SKU-2024-002" } ]
```

## §12-3. 검증 규칙

**하나라도 실패하면 아무것도 저장하지 않는다.** 일부만 들어가면 어디까지 반영됐는지 알 수 없어 더 위험하다.

| 검사 | 실패 시 |
|---|---|
| 시트 `생산량` 존재 | "생산량 시트를 찾을 수 없습니다" |
| 헤더 이름 일치 | 누락된 헤더명 표시 |
| `제품코드`가 `products.sku`에 존재 | 없는 코드 목록 표시 |
| `재료코드`가 `materials.code`에 존재 | 없는 코드 목록 표시 |
| `생산량`·`사용량`·`단가`가 숫자 | 해당 행 번호 표시 |
| 해당 월이 `draft` 상태 | "이미 마감된 달입니다" |

없는 코드는 **자동 생성하지 않는다.** 오타로 유령 제품이 생기는 것을 막기 위해서다. 신규 제품·재료는 [§3-3](02-products.md#3-3-생성-배합-포함)이나 [§2-2](02-products.md#2-2-등록)에서 먼저 만든 뒤 다시 업로드한다.

## §12-4. 전체 코드

```ts
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

type ProdRow  = { 제품코드: string; 제품명?: string; 생산량: number; 불량량?: number }
type UsageRow = { 제품코드: string; 재료코드: string; 재료명?: string; 사용량: number; 단가: number }

const trim = (v: unknown) => String(v ?? '').trim()

export async function importExcel(file: File, periodId: string) {
  // 1) 파싱
  const book = XLSX.read(await file.arrayBuffer())
  if (!book.Sheets['생산량']) {
    return { ok: false as const, errors: ['생산량 시트를 찾을 수 없습니다.'] }
  }
  const prodRows  = XLSX.utils.sheet_to_json<ProdRow>(book.Sheets['생산량'])
  const usageRows = book.Sheets['원재료투입']
    ? XLSX.utils.sheet_to_json<UsageRow>(book.Sheets['원재료투입'])
    : []

  // 2) 코드 수집 (중복 제거)
  const skus  = [...new Set([...prodRows, ...usageRows].map(r => trim(r.제품코드)).filter(Boolean))]
  const codes = [...new Set(usageRows.map(r => trim(r.재료코드)).filter(Boolean))]
  if (skus.length === 0) {
    return { ok: false as const, errors: ['제품코드 열이 비어 있습니다.'] }
  }

  // 3) uuid 매핑 (§12-2)
  const [prodRes, matRes] = await Promise.all([
    supabase.from('products').select('id, sku').in('sku', skus),
    codes.length
      ? supabase.from('materials').select('id, code').in('code', codes)
      : Promise.resolve({ data: [] as { id: string; code: string }[], error: null }),
  ])
  if (prodRes.error) return { ok: false as const, errors: [prodRes.error.message] }

  const productBySku   = new Map(prodRes.data?.map(p => [p.sku, p.id]))
  const materialByCode = new Map(matRes.data?.map(m => [m.code, m.id]))

  // 4) 검증 (§12-3)
  const errors = [
    ...skus.filter(s => !productBySku.has(s)).map(s => `등록되지 않은 제품코드: ${s}`),
    ...codes.filter(c => !materialByCode.has(c)).map(c => `등록되지 않은 재료코드: ${c}`),
  ]
  if (errors.length) return { ok: false as const, errors }

  // 5) 저장 (§5-2, §6-2)
  const { error: prodErr } = await supabase.from('production_records').upsert(
    prodRows.map(r => ({
      period_id:      periodId,
      product_id:     productBySku.get(trim(r.제품코드))!,
      production_qty: Number(r.생산량) || 0,
      defect_qty:     Number(r.불량량) || 0,
    })),
    { onConflict: 'period_id,product_id' },
  )
  if (prodErr) return { ok: false as const, errors: [prodErr.message] }

  if (usageRows.length) {
    const { error: usageErr } = await supabase.from('material_usages').upsert(
      usageRows.map(r => ({
        period_id:   periodId,
        product_id:  productBySku.get(trim(r.제품코드))!,
        material_id: materialByCode.get(trim(r.재료코드))!,
        usage_qty:   Number(r.사용량) || 0,
        unit:        'kg' as const,
        unit_price:  Number(r.단가) || 0,
        source:      'excel',
      })),
      { onConflict: 'period_id,product_id,material_id' },
    )
    if (usageErr) return { ok: false as const, errors: [usageErr.message] }
  }

  return { ok: true as const, productCount: prodRows.length, usageCount: usageRows.length }
}
```

## §12-5. 원본 보관

검증을 통과한 뒤에만 원본을 올린다. 실패한 파일까지 쌓이면 이력이 지저분해진다.

```ts
const result = await importExcel(file, periodId)
if (!result.ok) { showErrors(result.errors); return }

const path = `${periodId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
await supabase.storage.from('excel-uploads').upload(path, file)   // §10-1

await supabase.from('file_uploads').insert({                       // §10-2
  period_id:     periodId,
  storage_path:  path,
  original_name: file.name,
  file_name:     displayName,
  description,
  file_type:     file.type,
  size:          file.size,
  row_count:     result.productCount + result.usageCount,
})
```

> Storage 경로에는 한글이 들어가지 않도록 치환한다. 원본 파일명은 `original_name`에 그대로 보존되므로 이력 화면에서는 한글로 보인다.

---

[← 00-common](00-common.md) · [목차](../API.md) · [다음: 02-products →](02-products.md)
