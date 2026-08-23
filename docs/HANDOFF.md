# 인수인계 — 헷살 원가분석 시스템

> 새 대화에 이 파일을 통째로 붙여넣으면 맥락이 전달된다.
> 2026-08-20 기준.

---

## 1. 프로젝트

| 항목 | 값 |
|---|---|
| 경로 | `D:\Semesters\산학\Sunshine_Front-main` |
| 스택 | React 19 + Vite + TypeScript, Supabase (PostgreSQL + PostgREST + Storage) |
| 백엔드 서버 | **없음.** 프론트에서 `supabase-js` 로 직접 호출 |
| Supabase | `https://yxgitzuedrkbldqmxqya.supabase.co` |
| 저장소 | `github.com/SunshineHaddle/Sunshine_Front` — 브랜치 `main` (팀원 조현웅과 공유) |

도메인: 김치 제조업체(헷살종합식품)의 **월 단위 제품별 원가 계산**.

계정 (비밀번호 모두 `0000`)

| 아이디 | 이메일 | 역할 |
|---|---|---|
| `qwer1234` | `qwer1234@sunshine.local` | 관리자 (admin) |
| `worker1234` | `worker1234@sunshine.local` | 실무자 (entry) |

### 개발 명령

```bash
npm install     # git pull 후 package.json 이 바뀌었으면 반드시
npm run dev
npm run verify  # typecheck + lint + test 한 번에. 커밋 전에 돌린다
```

개별로는 `npm run typecheck` · `npm run lint` · `npm test`.
같은 검사가 GitHub Actions(`.github/workflows/ci.yml`)에서 push·PR 마다 돈다.

---

## 2. 데이터 흐름

```
[제품 관리]   제품·표준배합 등록        → products, recipe_items
     ↓
[1단계]      수불자료(.xlsx) 업로드     → material_usages   (제품별 실제 투입)
             생산량(kg) 직접 입력       → production_records
     ↓
[2단계]      인건비(%) · 경비(총액)     → operating_costs + allocations
     ↓
[3단계]      원가 계산 confirm_period()
               재료비 = 실적 있으면 material_usages, 없으면 recipe_items × 생산량
               단위원가 = 총원가 ÷ 생산량 × unit_weight_kg   (포장 1개당)
             → product_cost_summaries 저장 + 월을 confirmed 로 잠금
     ↓
[대시보드]   수익성표 · 원가 추이 차트 · PDF 내보내기
[제품 상세]  월별 원가 내역 · 12개월 추이 · 원재료비 상세
```

값을 고치려면 **마감 취소 → 수정 → 다시 계산**.
마감·마감취소는 1단계 화면에서도 할 수 있다 (3단계에서 옮겨왔다).

1단계 상단에는 **최근 12개월 칩**이 늘 떠 있다. 왼쪽이 가장 오래된 달, 오른쪽 끝이 이번 달.
DB 회차가 없는 달도 '미입력'(점선)으로 함께 보여주고, 누르면 그 달로 이동하며 회차가 만들어진다.

---

## 3. DB 구조 — 테이블 11 · 뷰 2 · RPC 3 · Storage 2

전체 스키마는 **`supabase/schema.sql`** 한 파일에 있다.
그 파일은 기록일 뿐이고, 실제 반영은 **SQL Editor에 붙여넣고 Run** 해야 한다 (Supabase는 저장소를 읽지 않음).

자세한 내용은 [DATA-MODEL.md](DATA-MODEL.md).

| 테이블 | 역할 |
|---|---|
| `profiles` | 사용자·역할 (`auth.users` 와 1:1) |
| `materials` | 원재료. **name 이 수불자료 품명과 글자까지 같아야 함** |
| `products` | 제품. **name 이 수불자료 시트명과 같아야 함**, `unit_weight_kg` 중요 |
| `recipe_items` | 제품 1단위 표준 배합 (실적 없는 달에만 사용) |
| `cost_periods` | 월 앵커. `status='confirmed'` 면 입력 잠김 |
| `production_records` | 제품별 생산량(kg) |
| `material_usages` | 수불자료가 들어오는 곳. 그 달 실제 투입 |
| `operating_costs` + `operating_cost_allocations` | 월 운영비와 제품별 배분 |
| `product_cost_summaries` | 월별 원가 스냅샷 (계산 결과 저장) |
| `file_uploads` | 엑셀 원본 이력 |

뷰: `v_product_recipe_cost`, `v_cost_trend_monthly`
RPC: `create_product_with_recipe`, `confirm_period`, `touch_last_active`
Storage: `product-images`(Public), `excel-uploads`(Private)

---

## 4. 설계 결정과 근거 — 되돌리지 말 것

**① 수율·불량률을 쓰지 않는다**
고객이 "월말 재고조사로 소요량을 확정한다"고 했다. 그러면 `material_usages` 값에 로스가 이미 포함돼 있어서, 수율을 또 곱하면 이중 반영이다. 관련 컬럼을 전부 제거했다.
미팅에서도 "불량률은 별도 관리하지 않고, 불량은 생산량에서 제외"로 확인됐다.

**② 계산 결과를 저장한다 (`product_cost_summaries`) — 단, 판매가는 예외**
매번 계산하는 뷰로 만들면 단가·배합을 고칠 때마다 과거 원가가 소급 변경된다. 마감 시점에 굳힌다.

**판매가만 `products` 의 현재 값을 읽는다** (`profitFrom()` in `results.ts`).
마감을 먼저 하고 나중에 판매가를 넣으면 표에 0 원이 박힌 채로 남았고,
고치려면 그 달 마감을 취소하고 다시 계산해야 했다. 판매가는 원가가 아니므로
굳힐 이유가 없다. 마진율·원가율·수익성 상태도 이 값으로 화면에서 다시 계산한다.
반대급부로 **판매가를 바꾸면 과거 달 마진율도 함께 바뀐다.**

**③ `unit_weight_kg` 가 필요하다**
원가는 kg 단위, 판매가는 포장 단위(5kg 1팩). 환산하지 않으면 마진율이 94%처럼 말이 안 되게 나온다.

**④ 엑셀은 이름으로 매칭한다**
실제 수불자료에 제품코드·재료코드 열이 없다. 시트명=제품명, 품명=재료명으로 맞춘다. 오타에 약해서 저장 전 미매칭 목록을 보여주는 2단계(preview → commit) 구조.

**⑤ 장부의 금액 열을 쓰지 않는다**
`amount` 는 generated 컬럼(`수량 × 단가`). 수불자료가 손글씨 전사본이라 장부 금액이 틀린 경우가 있다 (포기김치 249만원 차이 실제 확인).

**⑥ `profiles` 에 "자기 행 수정" 정책을 만들면 안 된다**
RLS는 컬럼 단위 제한이 안 돼서, 사용자가 자기 `role` 을 `admin` 으로 바꿀 수 있다(권한 상승). 실제로 발생시켜 확인했고 제거했다. 마지막 접속 갱신은 `touch_last_active()` RPC로만 한다.

**⑦ 2단계 배분은 생산량 비례를 쓴다**
`distributeByProduction()`. 미팅의 "경비는 생산량 기준 배분"과 일치한다.
`saveAutoCost`(재료비 비중 자동배분)도 구현돼 있으나 미사용.

**⑧ 마감 전에 생산량을 투입량과 대조한다**
`findProductionIssues()`. 생산량이 투입 총량의 50~150% 를 벗어나면 확인 다이얼로그를 띄운다.
예전에는 마진율이 `numeric(7,2)` 를 넘겨 `22003` 으로 터지는 게 오입력을 잡는 유일한 신호였는데,
컬럼을 `numeric(12,2)` 로 넓히면서 그 신호가 사라졌다. 고객이 "오차 허용"을 요구했으므로 막지는 않는다.

**⑨ 엑셀 수량 칸의 단위를 검증한다**
`parseQuantity()` 가 숫자부와 단위부를 갈라 해석한다. g·톤은 kg으로 환산하고, 개·박스·L처럼 kg으로 바꿀 수 없는 단위는 **저장을 막는다**. 자세한 규칙은 [EXCEL.md](EXCEL.md).

**⑩ 지어낸 값을 실제처럼 보여주지 않는다**
대시보드 제품 카드는 확정된 달이 없으면 그래프 대신 안내 문구를 띄운다.
예전에는 `trendPatterns` 라는 하드코딩 비율표에 배합 원가를 곱해 그럴듯한 곡선을 그렸는데,
갓 만든 제품에도 12개월 추이가 떠서 실제 데이터로 오해하게 만들었다. 폴백을 없앴다.

**⑪ 제품 삭제는 마감된 달이 있으면 시작조차 하지 않는다**
`findLockedPeriods()` 로 먼저 검사하고, 하나라도 있으면 **아무것도 건드리지 않고** 중단한다.
`DELETE` 는 RLS 에 막혀도 에러를 내지 않는다 — `USING` 이 필터로 작동해 조용히 건너뛴다.
그래서 검사 없이 지우면 draft 달 자료만 사라지고 제품은 남는 반쪽 상태가 된다.

검사 대상은 **네 곳 전부**여야 한다: `material_usages` `production_records`
`operating_cost_allocations` (+ `product_cost_summaries` 는 관리자 정책이 따로 있어 안 걸린다).
배분 테이블을 빼먹었다가, 사전 검사를 통과한 뒤 마지막 `products` DELETE 에서
`23503` 으로 터진 적이 있다. 배분은 `period_id` 가 없어 부모를 타고 회차를 찾아야 한다.

지울 수 없는 제품은 **목록에서 숨긴다** (`deactivateProduct`, `is_active = false`).
`products` 쓰기에는 `is_draft()` 제약이 없어 마감과 무관하게 언제나 가능하다.
과거 원가는 그대로 남고 제품 관리 하단 '숨긴 제품'에서 되돌린다.

숨긴 제품이 사라지는 곳과 남는 곳이 다르다:

| 화면 | 숨긴 뒤 |
|---|---|
| 제품 관리 · 1단계 생산량 · 대시보드 제품 카드 | 사라짐 (`fetchProducts` 가 `is_active` 로 거른다) |
| 대시보드 수익성 표 · 3단계 원가 표 | 사라짐 (`fetchCostSummaries` 의 `products!inner` 필터) |
| **대시보드 원가 추이 차트** | **금액에 그대로 포함** |

차트는 `v_cost_trend_monthly` 가 전 제품 `total_cost` 를 합산한다. 일부러 두었다 —
그 달에 실제로 쓴 돈이고, 지금 제품을 숨겼다고 과거 합계가 줄면 ② 와 어긋난다.

**⑫ 달 목록은 DB 회차가 아니라 달력에서 만든다**
1단계의 월 칩은 오늘 기준 12개월을 **항상** 생성하고, DB 회차는 상태(마감/작성중)만 입힌다.
회차가 있는 달만 그리면 입력한 달만 띄엄띄엄 떠서 줄 수가 들쭉날쭉했다.
칸이 좁아 상태 글자는 넣지 못하고 점 색·테두리로 구분한다 (툴팁으로 보완).

**⑬ 값이 비어 있으면 마감을 막는다 (경고가 아니라 차단)**
`findConfirmBlockers()`. 제품 상세에 뜨는 세 값의 근거를 마감 직전에 확인한다 —
원재료비 상세(`material_usages` 행), 재료비(실적 금액 또는 배합 × 생산량),
부자재비(`operating_cost_allocations`). 하나라도 비면 **마감 자체를 막는다.**

⑧·⑫와 달리 경고로 두지 않은 이유: 빈 값으로 마감된 제품은 나중에 손댈 수가 없다.
마감된 달은 삭제·수정이 RLS 에 막히고(⑪), 되돌리려면 그 달 전체를 열어
재계산해야 하는데 그 과정에서 과거 스냅샷이 바뀐다(②). 들어가기 전에 세우는 편이 싸다.

> ⚠️ 이 때문에 **수불자료 없이 표준 배합만으로 마감하는 경로가 막힌다.**
> `confirm_period()` 는 여전히 그 계산을 하지만 화면에서 도달할 수 없다.
> 표준원가 마감을 되살리려면 `'원재료비 상세'` 조건을 빼면 된다.

**⑭ 엑셀은 제품을 자동으로 만들지 않는다**
예전에는 파일을 고르는 순간 미매칭 시트명으로 제품이 생성됐다.
시트명 오타 하나가 그대로 새 제품이 됐고(`sku` 는 타임스탬프, 배합 수량 0,
`unit_weight_kg` 없음), 그 달을 마감하고 나면 지울 수도 없었다.
지금은 미매칭 목록과 등록 버튼을 보여주고 사람이 누르게 한다 —
④가 말한 preview → commit 구조에서 제품 생성만 빠져 있었다.

---

## 5. RLS

| 대상 | anon | 실무자(entry) | 관리자(admin) |
|---|---|---|---|
| 전체 읽기 | ❌ 0행 | ✅ | ✅ |
| `product_cost_summaries` 읽기 | ❌ | ❌ | ✅ |
| `products` `recipe_items` `product_cost_summaries` 쓰기 | ❌ | ❌ | ✅ |
| `materials` 등록 | ❌ | ✅ | ✅ |
| `cost_periods` 생성 | ❌ | ✅ | ✅ |
| 월별 입력 4종 | ❌ | ✅ draft만 | ✅ draft만 |
| 마감된 달 수정 | ❌ | ❌ | ❌ |
| `confirm_period` | ❌ | ✅ | ✅ |
| Storage 업로드 | ❌ | ✅ | ✅ |

헬퍼: `my_role()` `is_admin()` `is_editor()` `is_draft(uuid)` — 전부 `security definer`.

> ⚠️ **헬퍼는 false 가 아니라 NULL 을 돌려줄 수 있다.** `profiles` 행이 없거나
> `is_active = false` 면 `my_role()` 이 NULL 이고, `is_admin()`·`is_editor()` 도 NULL 이 된다.
> RLS 정책에서는 NULL 이 '거부'라 안전하지만, **plpgsql 의 `IF` 는 NULL 을 false 로 취급**해
> `if not is_editor()` 같은 가드가 오히려 통과시킨다.
> 함수 안에서 쓸 때는 `coalesce(is_editor(), false)` 로 감쌀 것.

`confirm_period` 는 `security definer` 다 — 실무자도 마감해야 하는데
`product_cost_summaries` 가 관리자 전용 쓰기라 invoker 로는 막힌다.
대신 RLS 를 지나치므로 **권한(`is_editor`)과 회차 상태(`draft`)를 함수가 직접 검사**한다.
`dev anon all` 정책은 제거됨. **로그인해야만 데이터가 보인다.**

`read` 정책은 나머지 10개 테이블에만 `using (true)` 로 걸려 있다.
**원가 결과(`product_cost_summaries`)만 `is_admin()` 으로 좁혔다.**
뷰 2개는 `security_invoker = true` 라 부른 사람의 권한으로 밑 테이블을 읽는다 —
이게 없으면 `v_cost_trend_monthly` 가 그 RLS 를 통째로 우회한다.

> ⚠️ 스키마 파일을 고쳐도 DB 는 바뀌지 않는다.
> `supabase/migrations/2026-08-20_admin-only-cost-read.sql` 을 SQL Editor 에서 실행해야 반영된다.

---

## 6. 연결 현황

**완료 — 테이블 11개 전부 + 뷰 2개 + Storage 2개**

| 화면 | 상태 |
|---|---|
| 로그인 / 세션 복구 / 로그아웃 | ✅ |
| 제품 관리 | ✅ 생성·판매정보 입력·완전 삭제·숨긴 제품 되돌리기 |
| 제품 상세 | ✅ 월별 원가 카드 3종, 3색 추이 그래프, 원재료비 상세(수불자료 실적) |
| 데이터 입력 1·2·3단계 | ✅ 1단계에 월 칩·마감/마감취소 포함 |
| 대시보드 | ✅ 수익성표(월 선택) + 원가 추이 + 제품별 카드 + PDF |
| 사용자 관리 | ✅ 목록·역할·활성 토글·업로드 이력 |
| 환율 산출 | ✅ 실시간 API + 제품 목록 연동 |

**제품 상세 값의 출처** — 전부 확정 스냅샷에서 온다.

| 화면 항목 | DB |
|---|---|
| 재료비 | `material_cost` |
| 부자재비 | `labor_cost + utility_cost` (제품 단위 부자재 구분이 스키마에 없다) |
| 총 금액 | `total_cost` |
| 원재료비 상세 | 그 달 `material_usages` (레시피가 아니다) |

**화면의 원가 단위** — 표에 세 가지 기준이 섞여 있으니 헷갈리지 말 것.

| 화면 | 기준 | DB |
|---|---|---|
| 대시보드 제조원가 · 경영 총원가 | **원/kg** | `(material+labor[+utility]) ÷ production_qty` |
| 대시보드·3단계 단위원가 | 원/포장 | `unit_cost` |
| 3단계 재료비 · 노무비 · 경비 | **원/kg** | 각 컬럼 ÷ `production_qty` |
| 제품 상세 재료비 · 부자재비 · 총 금액 | 월 전체 금액 | `material_cost` 등 그대로 |

환율 산출의 **계산 원가** 는 `unit_cost` 다 — 대시보드의 '단위원가' 열과 같은 값이고,
'경영 총원가' 열(원/kg)과는 다르다. `total_cost` 는 월 전체 금액이라 판매가와 단위가 맞지 않는다.

API 레이어: `src/lib/api/` — 자세한 목록은 [API.md](API.md).

**미구현 (미팅 요구 대비)** — [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) 참고.
선입선출 평균단가, 원자재/부자재 구분, 연말 합산, 레시피 불러오기.

---

## 7. 자주 걸리는 함정

**RLS는 읽기를 막을 때 에러를 내지 않는다.** `error: null` + 빈 배열. "데이터가 없다"와 구분이 안 된다. UPDATE도 0행 처리되므로, 반영 여부는 반환 행 수로 확인해야 한다.
**단, INSERT는 다르다** — `42501` 에러를 던진다. `describeDbError()` 가 한글로 바꿔준다.

**"마감된 달"이 가장 흔한 저장 실패 원인이다.** 관리자여도 막힌다(설계 의도).
`new row violates row-level security policy for table "material_usages"` 가 뜨면 권한이 아니라 `is_draft()` 에서 걸린 것. 1단계 또는 3단계에서 마감을 취소해야 한다.

**세션이 끊겨도 앱은 모른다 — `onSessionLost()` 를 쓴다.**
다른 기기에서 로그아웃하거나 토큰 갱신이 실패하면 조회는 계속 나가는데,
RLS 가 에러 대신 빈 배열을 주므로 화면은 "데이터가 없다"처럼 보인다.
`App.tsx` 가 이 구독으로 로그인 화면으로 되돌린다.

**렌더링 중 예외는 `ErrorBoundary` 가 잡는다.** 없으면 흰 화면이 된다.
이벤트 핸들러·비동기 오류는 잡지 못한다 — 그쪽은 각 화면의 try/catch 몫이다.

**화면 권한은 `resolveRoute()` 한 곳에서 판정한다.**
사이드바를 감추는 것만으로는 주소창에 `#dashboard` 를 직접 치는 걸 못 막는다.
초기 진입·해시 변경·`navigate()` 가 전부 이 함수를 거치고, 막힌 화면이면 주소창도 되돌린다.

**로그인 전에 조회하면 anon으로 나간다.** 세션 복구가 끝나기 전에 fetch를 걸면 조용히 0행. `App.tsx` 의 데이터 이펙트는 `loginRole` 을 의존성에 두고 게이트한다.

**`signOut()` 은 해당 계정의 모든 세션을 무효화한다.** 스크립트로 테스트하면 브라우저 세션이 죽는다. 테스트용 클라이언트는 `persistSession: false` + signOut 생략.

**`.in('col', [])`** 는 `in.()` 문법 오류. 빈 배열이면 호출하지 말 것.

**Supabase 응답은 기본 1,000행에서 잘린다 — 에러 없이.**
`material_usages` 처럼 (제품 수 × 재료 수 × 달) 로 쌓이는 테이블을 필터 없이 읽으면,
어느 순간부터 조용히 일부만 온다. "데이터가 없다"도 아니고 "틀린 데이터"가 된다.
기간이나 회차로 반드시 범위를 좁힐 것 (`fetchLatestUsageMaterials` 참고).

**숫자 입력은 `Number(v) || 0`** 로 변환. 빈 문자열이 그대로 가면 `22P02`.

**음수는 `NumberInput` 이 기본으로 막고, DB 에도 `check` 제약이 있다.**
음수는 에러가 아니라 조용한 실종으로 이어진다 — 생산량이 음수면 `confirm_period` 가
단위원가를 0 으로 두고, 수익성 표는 `.gt('production_qty', 0)` 으로 그 행을 뺀다.
자릿수 실수(⑧)는 경고라도 뜨는데 부호 실수는 제품이 통째로 사라진다.

**월은 `'YYYY-MM-01'`**. `'2026-08'` 을 date 컬럼에 넣으면 `22007`.

**generated 컬럼**(`amount` `manufacturing_cost` `total_cost`)은 insert/update에 포함하면 에러.

**`tsc -b` 는 증분 캐시를 쓴다.** IDE와 결과가 다르면 `npx tsc -b --force`.

**테스트는 `.ts` 구현을 직접 import 한다** (Node 24 의 타입 스트리핑).
예전에는 테스트마다 구현을 베껴 두고 검증해서, 원본만 고치면 테스트는 통과하는데
실제가 깨졌다. 그래서 순수 로직은 `.tsx`·supabase 의존 모듈에서 떼어 둔다 —
`chartAxis.ts` `profit.ts` `usageMaterials.ts` `monthFromFileName.ts` 가 그렇게 나왔다.
그 파일들은 **상대 import 를 두지 말 것** — 타입 스트리핑이 확장자를 요구해서
`../types` 같은 경로가 Node 에서 깨진다. 필요하면 한 줄 옮겨 적는다.

**`react-hooks/set-state-in-effect`** 는 함수 경계를 넘어 비동기성을 추적하지 못한다. 이펙트 안에서 `void (async () => { await fn() })()` 로 감싸면 통과.
다만 **상태 미러링 자체가 냄새**인 경우가 많다. 환율 페이지는 `useMemo` 파생으로 바꿔 이펙트를 없앴다.

**프로젝트 안에 `tsconfig.json` 을 가진 폴더가 생기면 린트가 통째로 죽는다.**
`.claude/worktrees/` 잔재 때문에 87건이 전부 파싱 에러였던 적이 있다.
`eslint.config.js` 에 `tsconfigRootDir` 를 명시해 막아뒀다.

**⚠️ 커밋하지 않은 변경은 pull 에서 조용히 사라진다.**
팀원 3명이 같은 `main` 에 올리므로 pull 이 잦다. 이번 주에 세 번 겪었다 —
막대 그래프 CSS 가 날아가 차트가 새까맣게 나왔고(SVG `<rect>` 의 기본 `fill` 은 검정),
없앴던 폴백 곡선이 되살아났다. **작업을 마치면 바로 커밋할 것.**
커밋해 두면 충돌로 드러나서 최소한 알아챌 수 있다.

**TSX 가 쓰는 클래스가 CSS 에 없으면 SVG 는 검게 칠해진다.**
머지 사고를 의심할 때 이 스크립트로 전수 확인할 수 있다:
`className` 을 수집해 `styles/**.css` 에 정의됐는지 비교하면 유실된 규칙이 바로 나온다.

---

## 8. 참고 문서

| 파일 | 내용 |
|---|---|
| `supabase/schema.sql` | **DB 전체 스키마 단일 파일** (가장 중요). 시드 없음 — 실행하면 빈 상태 |
| [DATA-MODEL.md](DATA-MODEL.md) | 테이블·뷰·RPC·RLS 상세 |
| [API.md](API.md) | `src/lib/api/` 함수별 명세 |
| [EXCEL.md](EXCEL.md) | 수불자료 양식과 검증 규칙 |
| [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) | 미팅 요구사항 대비 현재 상태 |
| `D:\카카오톡\sunshine-backend-design.md` | 팀 백엔드 설계서 |
| `D:\카카오톡\수불자료.xlsx` | 실제 양식 샘플 |

---

## 9. 현재 데이터 상태

Supabase 는 한 번 **완전 초기화**(`schema.sql` 전체 재실행)를 거친 뒤,
2026년 1~12월 테스트 데이터가 들어가 있다.

| 항목 | 상태 |
|---|---|
| 제품 | 6개 — 포기김치 · 맛김치 · 총각김치 · 열무김치 · 백김치 · 갓김치 |
| 원재료 | 20종 (배추 · 무 · 고춧가루(국)/(수) · 매실액기스 · 쪽파 · 청각 등) |
| 월 회차 | 2026-01 ~ 2026-12, 전부 `confirmed` |
| 투입내역 | 756행 (12개월 × 6제품) |
| 운영비 | 월 인건비 3.2억 + 전기·수도 7,800만 (임의값) |

`recipe_items`(표준 배합)는 대부분 비어 있거나 수량 0 이다.
엑셀에서 자동 등록된 제품은 재료 목록만 만들어지고 값은 0 으로 들어간다.
수불자료가 있는 달은 `cost_source='actual'` 로 계산되므로 원가에는 영향이 없다.

### 만들어 둔 테스트 자산

| 경로 | 내용 |
|---|---|
| `D:\카카오톡\수불자료_2026_1월-12월\` | 12개월치 수불자료 엑셀 (계절 변동 반영) |
| `D:\카카오톡\시드_2026_12개월.sql` | 위 데이터를 한 번에 넣는 SQL (마감까지 자동) |

**되돌리기** — 제품·재료는 남고 월별 데이터만 사라진다:

```sql
delete from cost_periods where period between '2026-01-01' and '2026-12-01';
```

---

## 10. 다음 작업

우선순위 순.

0. **표준 배합 채우기** — 6개 제품 중 `recipe_items` 수량이 0보다 큰 것은
   테스트 제품 하나뿐이다. 마감 전 경고(⑬)는 붙였지만 값 자체는 여전히 비어 있다.
   수불자료 없는 달을 마감하려면 배합을 채워야 한다 (제품 상세 > 표준 배합 수정).
1. **선입선출 평균단가** — 미팅에서 여섯 번 언급됐는데 개념 자체가 없다.
   시작 전에 **매입 자료가 어디서 들어오는지** 고객에게 확인해야 한다.
   수불자료는 소요량만 담고 매입 정보가 없다. [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) §3
2. **원자재/부자재 구분** — `materials` 에 분류 컬럼이 없어 나눠 볼 수 없다. §5
3. **연말 합산** — 월별 집계까지만 있고 연 단위가 없다. §4
4. 레시피 불러오기 — 새 제품마다 배합을 처음부터 입력해야 한다. §6
5. `맛지리는김치` — 테스트로 만든 제품이 목록에 남아 있다. 지울지 확인 필요.

### 고객 확인이 필요한 질문

`REQUIREMENTS-GAP.md` 마지막에 5개를 정리해 뒀다. 그중 1·2번이 특히 막혀 있다.

1. 선입선출 평균단가에 쓸 **매입 자료는 어디서** 들어오나?
2. 2단계에서 **실무자와 관리자의 경계**는? (경비 금액 입력 vs 가중치 조정)

---

## 11. 팀 협업

`main` 브랜치를 셋이 공유한다 (`HGUSonny` · `haeun` · `01`).
pull 이 잦으니 **작업 후 바로 커밋**할 것 — §7 마지막 항목 참고.

배포는 Vercel (`sunshine-front.vercel.app`). push 하면 자동 빌드된다.
**로컬에서 잘 되는데 배포본이 다르면 push 여부부터 확인**할 것.
dev 서버는 자동 새로고침이 꺼져 있어 (`npm run dev`) 브라우저에서 직접 새로고침해야 한다.
