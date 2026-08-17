# API 레이어

`src/lib/api/` — 프론트에서 Supabase를 직접 호출한다. 백엔드 서버는 없다.

공통 규칙:

- `supabase-js` 는 throw 하지 않고 `{ data, error }` 를 준다. 각 파일의 `unwrap()` 이 한 번 감싼다.
- **RLS가 읽기를 막으면 에러 없이 빈 배열**이 온다. "권한 없음"과 "데이터 없음"이 구분되지 않는다.
- **UPDATE도 0행으로 조용히 끝난다.** 반영 여부는 `.select()` 반환 행 수로 확인한다 (`setProfileActive` 참고).
- **INSERT는 다르다.** RLS 위반 시 `42501` 에러를 던진다.

---

## errors.ts

**`describeDbError(error)`** → 한글 메시지

RLS 위반(`42501`)을 원인별로 번역한다. RLS가 아닌 에러는 원문을 그대로 통과시킨다.

| 테이블 | 메시지 |
|---|---|
| 월별 입력 4종 | "이 달은 이미 마감되어 …을(를) 수정할 수 없습니다. 3단계에서 마감을 취소한 뒤…" |
| 마스터 4종 | "…등록·수정은 관리자만 가능합니다." |

페이지의 `catch` 블록에서 쓴다.

---

## auth.ts — 로그인 / 프로필

Supabase Auth는 이메일 기준이라 아이디 뒤에 `@sunshine.local` 을 붙인다.

| 함수 | 설명 |
|---|---|
| `signIn(loginId, password)` | 프로필이 없거나 비활성이면 로그아웃시키고 실패를 돌려준다 |
| `getSessionUserId()` | 세션 복구용 |
| `signOut()` | **해당 계정의 모든 세션을 무효화한다** |
| `fetchMyProfile(userId)` | |
| `touchLastActive()` | RPC. 직접 update 하면 권한 상승 위험 |
| `fetchProfiles()` | 관리자 화면 |
| `setProfileActive(id, bool)` → `boolean` | **반환값으로 반영 여부 판정** |
| `setProfileRole(id, role)` → `boolean` | 동일 |

`toLoginRole()` — `entry` → `worker`, 그 외 → `admin`. 화면 라우팅용.

---

## products.ts — 원재료 · 제품 · 배합

| 함수 | 설명 |
|---|---|
| `fetchMaterials()` | 활성 원재료 목록 |
| `createMaterial({name, unit, unitPrice})` | 새 재료. uuid를 돌려준다 |
| `fetchProducts()` | 배합까지 조인해서 가져온다 |
| `fetchProduct(id)` | |
| `createProductWithRecipe(...)` | RPC 호출 |
| `updateProduct(id, patch)` | |
| `uploadProductImage(id, file)` | `shrinkImage(512)` 후 Storage 업로드 → 공개 URL 저장 |
| `saveRecipeItems(productId, items)` | upsert 후, 화면에서 뺀 재료를 delete |
| `deactivateProduct(id)` | `is_active = false` |

> `saveRecipeItems` 는 `kept` 가 비면 `.not('in', '()')` 문법 오류가 나므로 전체 삭제로 분기한다.

---

## periods.ts — 월 회차

| 함수 | 설명 |
|---|---|
| `ensurePeriod('YYYY-MM')` | 없으면 만들고 있으면 준다. 내부에서 `YYYY-MM-01` 로 변환 |
| `fetchPeriods()` | |
| `fetchLatestConfirmedPeriod()` | 대시보드 기본값. **없으면 `null`** |
| `reopenPeriod(id)` | 마감 취소 → `draft` |

> 대시보드가 비어 보이는 가장 흔한 원인은 `fetchLatestConfirmedPeriod()` 가 `null` 인 것.
> 즉 아직 한 번도 마감하지 않은 상태다.

---

## production.ts — 생산량 / 투입 실적

| 함수 | 설명 |
|---|---|
| `fetchProduction(periodId)` | |
| `saveProduction(periodId, rows)` | upsert |
| `fetchMaterialUsages(periodId, productId?)` | |
| `saveMaterialUsages(...)` | 현재 UI 미사용 (엑셀 경로가 대신함) |
| `deleteMaterialUsages(periodId, productId?)` | 지우면 마감 시 표준원가로 되돌아간다 |

---

## operating.ts — 운영비

| 함수 | 설명 |
|---|---|
| `fetchOperatingCosts(periodId)` | 배분까지 조인 |
| `saveLaborCost(periodId, total, productFees)` | 인건비. 제품별 **퍼센트** 배분 |
| `saveCustomCost(periodId, name, allocation, opts)` | 기타 항목. **금액** 배분 |
| `deleteOperatingCost(costId)` | |
| `saveAutoCost(...)` | 재료비 비중 자동배분. **미사용** |

배분 계산은 `pages/operating-cost-entry/operatingCostModel.ts` 의
`distributeByProduction()` — 생산량 비례.

---

## results.ts — 마감 / 수익성 / 추이

| 함수 | 설명 |
|---|---|
| `confirmPeriod(periodId)` → 저장된 제품 수 | RPC. `22003`(오버플로)을 한글로 번역한다 |
| `fetchCostSummaries(periodId)` | 수익성 표 |
| `fetchCostTrend(fromPeriod)` | `v_cost_trend_monthly`. 확정된 달만 |
| `fetchUnitCostTrend(productId, from)` | 제품 12개월 단가. **`!inner` 없으면 기간 필터가 안 먹는다** |
| `fetchRecipeCostSummary()` | `v_product_recipe_cost` |

---

## files.ts — 엑셀 원본 보관

| 함수 | 설명 |
|---|---|
| `uploadExcel({periodId, file, ...})` | Storage 업로드 + `file_uploads` 기록. `uploaded_by` 를 세션에서 채운다 |
| `fetchFileHistory({periodId?, uploadedBy?, limit?})` | 업로더 이름까지 조인 |
| `createDownloadUrl(path, sec)` | Private 버킷이라 서명 URL |
| `deleteFile(id, path)` | Storage + 테이블 양쪽 |

> Storage 경로에는 한글이 못 들어간다. 원본명은 DB의 `original_name` 에 보존한다.

---

## importSubul.ts — 수불자료 파이프라인

```
previewSubul(file)  파싱 → 이름 매칭 → 미매칭·오류 목록
        ↓  (사용자 확인)
commitSubul(periodId, preview)  material_usages 저장
```

| 함수 | 설명 |
|---|---|
| `previewSubul(file)` → `SubulPreview` | 저장하지 않는다. 확인용 |
| `createMissingMaterials(names, priceByName)` | 미매칭 재료를 한 번에 등록 |
| `createMissingProducts(names)` | 시트명으로 제품 생성. **관리자만** |
| `commitSubul(periodId, preview)` → 저장 행 수 | `preview.errors` 가 있으면 **거부한다** |

`SubulPreview` 의 `errors` 는 사람이 엑셀을 고쳐야 하는 문제,
`warnings` 는 넘어가도 되는 알림이다. 자세한 규칙은 [EXCEL.md](EXCEL.md).

> `createMissingProducts` 로 만든 제품은 `sale_price = 0`, `unit_weight_kg = null` 이다.
> 그대로 마감하면 마진율이 0% 로 나온다. 제품 관리에서 채워야 한다.

---

## exchangeRates.ts — 실시간 환율

`open.er-api.com` (무료·키 불요·CORS 허용). localStorage에 6시간 캐싱.

| 함수 | 설명 |
|---|---|
| `fetchExchangeRates(force?)` | 실패 시 `{rates:{}, updatedAt:0}`. throw 하지 않는다 |
| `fetchPillRates()` | 대시보드 카드용 4종 + 갱신 시각 |

> 응답이 "1 KRW = rates[code]" 형태라 앱이 쓰는 "1 외화 = ? 원"으로 뒤집는다.
> 실패하면 호출부의 하드코딩 폴백이 그대로 보이므로, **화면에 "기준값(실시간 조회 실패)"을 표시해야 한다.**
> 전일 대비 변동률은 제공하지 않는다 (예전 하드코딩 값은 제거됨).
