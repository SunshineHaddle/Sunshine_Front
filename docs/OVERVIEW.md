# 시스템 개요 — 테이블 구조와 API 연결 현황

> 2026-08-11 기준. DB에 직접 접속해 확인한 상태.
> 상세 API 명세는 [API.md](API.md), 셋업 절차는 [SETUP.md](SETUP.md).

---

## 1. 전체 구조

```
브라우저 (React + Vite)
   │
   │  supabase-js  ← 별도 백엔드 서버 없음
   ▼
Supabase (PostgreSQL + PostgREST + Storage)
   테이블 11 · 뷰 2 · RPC 2 · Storage 2
```

권한은 **RLS(Row Level Security)** 가 담당한다. anon key는 브라우저에 노출되는 게 정상이고,
RLS가 유일한 방어선이다. 현재는 개발 편의를 위해 `dev anon all` 정책이 열려 있다.

---

## 2. 테이블 설명

### 2-1. 마스터 — 잘 안 바뀌는 기준 정보

| 테이블 | 무엇을 담나 | 현재 행 수 |
|---|---|---|
| `materials` | 원재료 카탈로그. 배추·고춧가루 등 품명과 기준 단가 | **14** |
| `products` | 제품. SKU·제품명·규격·판매가 | **2** |
| `recipe_items` | 제품 1단위 **표준 배합**. "포기김치 1포기에 배추 5kg" | 0 |
| `profiles` | 사용자. 로그인 ID·이름·역할(admin/entry/reviewer) | **0** ⚠️ |

**`materials.name`은 수불자료의 품명과 글자까지 일치해야 한다.** 엑셀 업로드가 이름으로 매칭하기 때문이다.
현재 14개는 `수불자료.xlsx`에서 그대로 옮겼다.

**`recipe_items`가 0인 이유**: 지금은 수불자료(실적)로만 원가를 계산하고 있어서다.
배합을 넣으면 실적이 없는 달에도 "표준원가"로 계산된다 (§4-3 참고).

**`profiles`가 0인 이유**: Auth 계정은 만들어져 있지만 연결 SQL을 아직 실행하지 않았다.
이 상태에서는 관리자 권한 판정(`is_admin()`)이 항상 false다.

### 2-2. 월별 입력 — 매달 쌓이는 실적

| 테이블 | 무엇을 담나 | 현재 행 수 |
|---|---|---|
| `cost_periods` | **월 회차.** 모든 월별 데이터의 기준점 | **1** (2026-08) |
| `production_records` | 제품별 생산량 + 불량률 3종(입고·공정·완제품) | **2** |
| `material_usages` | 제품별 **실제 원재료 투입 실적**. 수불자료가 여기로 들어온다 | **28** |
| `operating_costs` | 월별 운영비 항목 (인건비·전기세 등) | **3** |
| `operating_cost_allocations` | 위 항목의 제품별 배분 | 0 |

`cost_periods.period`는 **반드시 그 달 1일**(`2026-08-01`)이다. `'2026-08'` 문자열을 넣으면 에러가 난다.

`cost_periods.status`가 잠금장치다.
- `draft` — 1·2단계 입력 가능
- `confirmed` — 마감됨. 입력이 RLS에 막힌다. 고치려면 3단계에서 **마감 취소**

### 2-3. 결과 — 계산해서 굳힌 값

| 테이블 | 무엇을 담나 | 현재 행 수 |
|---|---|---|
| `product_cost_summaries` | 월별 제품 원가 **스냅샷** | **2** |
| `file_uploads` | 업로드한 엑셀 원본 이력 | 0 |

**왜 계산 결과를 저장하나?** 나중에 단가나 배합을 고쳐도 **지난달 원가는 그때 값 그대로** 남아야 하기 때문이다.
마감 시점에 굳혀두지 않으면 마스터를 손댈 때마다 과거 실적이 소급해서 바뀐다.

`manufacturing_cost`(재료비+노무비)와 `total_cost`(+경비)는 **generated 컬럼**이라 자동 계산된다.
insert/update에 넣으면 에러가 난다.

`cost_source`가 그 달 재료비를 어디서 가져왔는지 알려준다.
- `actual` — 수불자료 실적 사용
- `standard` — 실적이 없어 `recipe_items × 생산량`으로 계산

### 2-4. 뷰 · RPC · Storage

| 이름 | 종류 | 역할 |
|---|---|---|
| `v_product_recipe_cost` | 뷰 | 제품별 표준 재료비·재료 개수 집계 |
| `v_cost_trend_monthly` | 뷰 | 월별 원가 추이 집계 (대시보드 차트) |
| `create_product_with_recipe` | RPC | 제품+배합을 **한 트랜잭션**으로 생성 |
| `confirm_period` | RPC | 월 마감. 1·2단계 → 원가 계산 → 스냅샷 |
| `product-images` | Storage | 제품 대표 이미지 (Public) |
| `excel-uploads` | Storage | 수불자료 원본 (Private) |

뷰에는 RLS를 걸 수 없어 `GRANT SELECT`로 처리했다.

---

## 3. 데이터 흐름

```
[제품 관리]  제품·배합 등록          → products, recipe_items
     │
[1단계]     수불자료(.xlsx) 업로드   → material_usages   (제품별 실제 투입)
            생산량·불량률 입력       → production_records
     │
[2단계]     인건비(%) · 경비(금액)   → operating_costs + allocations
     │
[3단계]     원가 계산 (confirm_period)
              재료비 = 실적 있으면 material_usages, 없으면 recipe_items × 생산량
              노무비·경비 = allocations.amount
              수율 = (1-입고불량)(1-공정폐기)(1-완제품불량)
            → product_cost_summaries 에 저장, 월을 confirmed 로 잠금
     │
[대시보드]  스냅샷 조회 → 수익성표 · 원가 추이 차트
[제품 상세] 스냅샷 조회 → 12개월 단가 추이
```

값을 고치면 **3단계 → 마감 취소 → 수정 → 다시 계산** 순서로 재계산된다.

---

## 4. API 연결 현황

별도 서버가 없으므로 "API"는 `src/lib/api/*` 의 함수를 뜻한다.
각 함수는 [API.md](API.md)의 섹션 번호와 1:1로 대응한다.

### 4-1. 연결 완료 — 27개

#### 원재료 · 제품 · 배합 ([02-products.md](api/02-products.md))

| 함수 | 명세 | 화면 | 테이블 |
|---|---|---|---|
| `fetchMaterials` | §2-1 | 제품 생성 재료 검색 | `materials` |
| `createMaterial` | §2-2 | 제품 생성 "새 재료 추가" | `materials` |
| `fetchProducts` | §3-1 | 제품 관리 목록 | `products`+`recipe_items` |
| `createProductWithRecipe` | §3-3 | 제품 생성 저장 | RPC |
| `updateProduct` | §3-4 | 제품명·이미지 수정 | `products` |
| `uploadProductImage` | §3-5 | 제품 상세 사진 변경 | Storage+`products` |
| `saveRecipeItems` | §3-6 | 제품 상세 "배합 수정" | `recipe_items` |
| `deactivateProduct` | §3-7 | 제품 상세 "제품 숨기기" | `products` |

#### 데이터 입력 ([03-cost-entry.md](api/03-cost-entry.md))

| 함수 | 명세 | 화면 | 테이블 |
|---|---|---|---|
| `ensurePeriod` | §4-1 | 월 선택 시 자동 | `cost_periods` |
| `fetchProduction` | §5-1 | 1단계 생산량 표 | `production_records` |
| `saveProduction` | §5-2 | 1단계 저장 | `production_records` |
| `fetchMaterialUsages` | §6-1 | 1단계 "저장된 투입내역" | `material_usages` |
| `commitSubul` | §6-2 | 1단계 엑셀 저장 | `material_usages` |
| `deleteMaterialUsages` | §6-3 | 1단계 투입내역 삭제 | `material_usages` |
| `fetchOperatingCosts` | §7-1 | 2단계 조회 | `operating_costs` |
| `saveLaborCost` | §7-2(1) | 2단계 인건비 % 배분 | `operating_costs`+배분 |
| `saveCustomCost` | §7-2(2) | 2단계 커스텀 항목 | `operating_costs`+배분 |
| `deleteOperatingCost` | §7-3 | 2단계 항목 삭제 | `operating_costs` |

#### 결과 · 대시보드 ([04-results.md](api/04-results.md))

| 함수 | 명세 | 화면 | 대상 |
|---|---|---|---|
| `confirmPeriod` | §8-1 | 3단계 "원가 계산" | RPC |
| `reopenPeriod` | — | 3단계 "마감 취소" | `cost_periods` |
| `fetchCostSummaries` | §8-2 | 3단계 원가표 · 대시보드 수익성표 | `product_cost_summaries` |
| `fetchLatestConfirmedPeriod` | §8-2 | 대시보드 기준월 | `cost_periods` |
| `fetchCostTrend` | §9-1 | 대시보드 원가 추이 차트 | `v_cost_trend_monthly` |
| `fetchUnitCostTrend` | §9-2 | 제품 상세 12개월 추이 | `product_cost_summaries` |
| `fetchRecipeCostSummary` | §9-3 | 제품 목록 재료비 | `v_product_recipe_cost` |

#### 엑셀 파이프라인 ([01-frontend.md §12](api/01-frontend.md))

| 함수 | 역할 |
|---|---|
| `previewSubul` | 파싱 + 이름 매칭. **저장 전 미매칭 확인용** |
| `createMissingMaterials` | 미매칭 재료를 한 번에 등록 |
| `parseSubulWorkbook` | SheetJS 파서 (동적 import) |

### 4-2. 연결 안 함 — 2개

| 함수 | 명세 | 이유 |
|---|---|---|
| `fetchProduct` | §3-2 | §3-1 목록이 배합까지 가져와서 상세에서 재조회할 이유가 없다. 새로고침 딥링크가 필요해지면 붙인다 |
| `fetchPeriods` | §4-2 | 월 선택이 `input[type=month]`라 목록이 필요 없다. 드롭다운으로 바꾸면 붙인다 |

### 4-3. 다른 문서 범위 — 미연결

| 대상 | 상태 |
|---|---|
| 로그인 (§11) | `qwer1234`/`0000` 하드코딩. Supabase Auth 미연결 |
| 사용자 관리 (§11-4·§11-5) | `profiles` 조회·수정 미연결 |
| 파일 이력 (§10) | `file_uploads` 를 쓰는 화면 없음 |
| 환율 산출 (F-1) | 환율 상수 + localStorage |
| PDF 생성 (F-2) | 미착수 |

---

## 5. 알려진 문제

### 5-1. 마진율이 94%로 나온다 ⚠️

원가는 **kg당**(1,747원)인데 판매가는 **5kg 포장당**(28,900원)이라 단위가 안 맞는다.

`products.unit_weight_kg` 컬럼과 고쳐진 `confirm_period`가 필요하다.
→ [SETUP.md B-1](SETUP.md) 블록을 SQL Editor에서 실행

### 5-2. Storage 버킷 미생성

`product-images`(Public), `excel-uploads`(Private) 둘 다 없다.
제품 이미지 업로드(§3-5)가 `404 Bucket not found`로 실패한다.

### 5-3. `profiles` 0행

Auth 계정은 있지만 연결 SQL 미실행. 관리자 권한이 동작하지 않는다.

### 5-4. `dev anon all` 정책이 열려 있음

anon key만 있으면 누구나 DB를 읽고 쓸 수 있는 상태다.
**배포 전 반드시 제거**하고 로그인을 Supabase Auth로 붙여야 한다. → [00-common.md §0-5](api/00-common.md)

### 5-5. 임시 데이터가 섞여 있다

수불자료 28행은 실제 데이터지만, 아래는 **지어낸 값**이다.

| 항목 | 임시값 | 근거 |
|---|---|---|
| 생산량 | 포기 796,524kg / 맛 93,550kg | 투입총량 × 94% |
| 인건비 | 286,677,945원 | 재료비의 25% |
| 전기·수도 | 80,269,825원 | 재료비의 7% |
| 이자비용 | 34,401,353원 | 재료비의 3% |
| 불량률 | 입고2 / 공정3 / 완제품1 % | 임의 |
| 판매가 | 28,900 / 6,500원 | 옛 목데이터 |

실제 값을 받으면 화면에서 고친 뒤 3단계 **다시 계산**을 누르면 반영된다.

---

## 6. 수불자료 양식

현장 장부를 그대로 받는다. 제품코드·재료코드 열이 없어 **한글 이름으로 매칭**한다.

```
시트 '포기김치'      ← 시트 이름이 곧 제품명
  4행  품명 | 수량(kg) | 단가(원) | 금액(원)
  5행  배추 | 696948   | 865.51   | 601706145
 19행  합계 |          |          | 1032999991   ← 여기서 종료

시트 '맛김치'        ← 제품마다 시트 하나
시트 '업로드_템플릿'  ← 이름에 '템플릿' 이 있으면 건너뜀
```

파서가 흡수하는 변형: 헤더 행 위치(3행/4행), 헤더 이름 변형(품명=품목=재료명), 숫자 표기(`1,234` `₩1234`).

**금액 열은 읽기만 하고 저장하지 않는다.** DB의 `amount`가 `수량 × 단가`로 다시 계산되기 때문이다.
수불자료는 손글씨 전사본이라 장부 금액이 틀린 경우가 있는데(`수불자료.xlsx` 포기김치는 249만원 차이),
이 설계 덕분에 DB 값은 항상 정합이다.

**생산량은 이 파일에 없다.** 1단계 화면에서 직접 입력해야 한다.
