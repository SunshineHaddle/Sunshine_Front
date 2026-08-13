# 인수인계 — 헷살 원가분석 시스템

> 새 대화에 이 파일을 통째로 붙여넣으면 맥락이 전달된다.
> 2026-08-13 기준.

---

## 1. 프로젝트

| 항목 | 값 |
|---|---|
| 경로 | `D:\Semesters\산학\Sunshine_Front-main` |
| 스택 | React 19 + Vite + TypeScript, Supabase (PostgreSQL + PostgREST + Storage) |
| 백엔드 서버 | **없음.** 프론트에서 `supabase-js`로 직접 호출 |
| Supabase | `https://yxgitzuedrkbldqmxqya.supabase.co` |
| 브랜치 | `main` (팀원 조현웅과 공유) |
| 예전 작업 백업 | `supabase-integration` 브랜치 |

도메인: 김치 제조업체(헷살종합식품)의 **월 단위 제품별 원가 계산**.

계정 (비밀번호 모두 `0000`)

| 아이디 | 이메일 | 역할 |
|---|---|---|
| `qwer1234` | `qwer1234@sunshine.local` | 관리자 (admin) |
| `worker1234` | `worker1234@sunshine.local` | 실무자 (entry) |

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
[대시보드]   수익성표 · 원가 추이 차트
[제품 상세]  12개월 단가 추이
```

값을 고치려면 **3단계 → 마감 취소 → 수정 → 다시 계산**.

---

## 3. DB 구조 — 테이블 11 · 뷰 2 · RPC 3 · Storage 2

전체 스키마는 **`supabase/schema.sql`** 한 파일에 있다.
그 파일은 기록일 뿐이고, 실제 반영은 **SQL Editor에 붙여넣고 Run** 해야 한다 (Supabase는 저장소를 읽지 않음).

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

**② 계산 결과를 저장한다 (`product_cost_summaries`)**
매번 계산하는 뷰로 만들면 단가·배합을 고칠 때마다 과거 원가가 소급 변경된다. 마감 시점에 굳힌다.

**③ `unit_weight_kg` 가 필요하다**
원가는 kg 단위, 판매가는 포장 단위(5kg 1팩). 환산하지 않으면 마진율이 94%처럼 말이 안 되게 나온다.

**④ 엑셀은 이름으로 매칭한다**
실제 수불자료에 제품코드·재료코드 열이 없다. 시트명=제품명, 품명=재료명으로 맞춘다. 오타에 약해서 저장 전 미매칭 목록을 보여주는 2단계(preview → commit) 구조.

**⑤ 장부의 금액 열을 쓰지 않는다**
`amount` 는 generated 컬럼(`수량 × 단가`). 수불자료가 손글씨 전사본이라 장부 금액이 틀린 경우가 있다 (포기김치 249만원 차이 실제 확인).

**⑥ `profiles` 에 "자기 행 수정" 정책을 만들면 안 된다**
RLS는 컬럼 단위 제한이 안 돼서, 사용자가 자기 `role` 을 `admin` 으로 바꿀 수 있다(권한 상승). 실제로 발생시켜 확인했고 제거했다. 마지막 접속 갱신은 `touch_last_active()` RPC로만 한다.

**⑦ 2단계 배분은 팀원 방식(생산량 비례)을 쓴다**
`distributeByProduction()`. `saveAutoCost`(재료비 비중 자동배분)도 구현돼 있으나 미사용.

---

## 5. RLS — 완료, 24개 항목 실측 검증

| 대상 | anon | 실무자(entry) | 관리자(admin) |
|---|---|---|---|
| 전체 읽기 | ❌ 0행 | ✅ | ✅ |
| `products` `recipe_items` `product_cost_summaries` 쓰기 | ❌ | ❌ | ✅ |
| `materials` 등록 | ❌ | ✅ | ✅ |
| `cost_periods` 생성 | ❌ | ✅ | ✅ |
| 월별 입력 4종 | ❌ | ✅ draft만 | ✅ draft만 |
| 마감된 달 수정 | ❌ | ❌ | ❌ |
| `confirm_period` | ❌ | ❌ | ✅ |
| Storage 업로드 | ❌ | ✅ | ✅ |

헬퍼: `my_role()` `is_admin()` `is_editor()` `is_draft(uuid)` — 전부 `security definer`.
`dev anon all` 정책은 제거됨. **로그인해야만 데이터가 보인다.**

---

## 6. 연결 현황

**완료 — 테이블 11개 전부 + 뷰 2개 + Storage 2개**

| 화면 | 상태 |
|---|---|
| 로그인 / 세션 복구 / 로그아웃 | ✅ |
| 제품 관리 · 상세 · 생성 | ✅ (배합 수정, 이미지 업로드, 12개월 추이 포함) |
| 데이터 입력 1·2·3단계 | ✅ |
| 대시보드 (수익성표 + 원가 추이 차트) | ✅ |
| 사용자 관리 (목록·역할 변경·활성 토글) | ✅ |

API 레이어: `src/lib/api/` — `auth` `products` `periods` `production` `operating` `results` `files` `importSubul`, 파서는 `src/lib/excel/parseSubul.ts`

**미연결**

| 항목 | 비고 |
|---|---|
| **환율** | `ExchangeRateCalculatorPage` 의 `currencySettings` 상수 + localStorage. 사용자 요청으로 보류 |
| **PDF 생성** | 미착수. 다음 작업 대상 |
| `DashboardSummaryCharts.tsx:242` 린트 에러 | 팀원 코드. 렌더 중 ref 접근 |

미사용 함수 5개(`fetchProduct` `fetchPeriods` `saveAutoCost` `saveMaterialUsages` `findAmountMismatches`)는 의도적. 현재 UI에서 불필요하거나 다른 함수 내부에서 호출됨.

---

## 7. 지금 진행 중인 것 ⚠️

**3단계 원가 계산이 실패한다.** 원인은 파악 완료.

```
ERROR 22003 numeric field overflow
```

생산량이 24kg / 36kg 로 들어가 있는데 재료비가 10.3억이라 단위원가가 2억이 되고,
마진율 -742,772% 가 `numeric(7,2)` 를 넘긴다.

**해야 할 일 2가지**

① SQL Editor에서 실행 (아직 안 됨)
```sql
alter table product_cost_summaries
  alter column margin_rate type numeric(12,2),
  alter column cost_rate   type numeric(12,2);
```

② 1단계에서 생산량을 실제 값으로 (지금은 테스트값)

| 제품 | 투입 총량 | 권장 생산량 |
|---|---|---|
| 포기김치 | 847,366 kg | 약 796,500 |
| 맛김치 | 99,521 kg | 약 93,550 |

프론트 쪽은 이미 처리됨 — `confirmPeriod()` 가 `22003` 을 잡아 한글 안내로 바꾼다.
`supabase/schema.sql` 에도 `numeric(12,2)` 반영됨.

---

## 8. 자주 걸리는 함정

**RLS는 읽기를 막을 때 에러를 내지 않는다.** `error: null` + 빈 배열. "데이터가 없다"와 구분이 안 된다. UPDATE도 0행 처리되므로, 반영 여부는 반환 행 수로 확인해야 한다.

**로그인 전에 조회하면 anon으로 나간다.** 세션 복구가 끝나기 전에 fetch를 걸면 조용히 0행. `App.tsx` 의 데이터 이펙트는 `loginRole` 을 의존성에 두고 게이트한다.

**`signOut()` 은 해당 계정의 모든 세션을 무효화한다.** 스크립트로 테스트하면 브라우저 세션이 죽는다. 테스트용 클라이언트는 `persistSession: false` + signOut 생략.

**`.in('col', [])`** 는 `in.()` 문법 오류. 빈 배열이면 호출하지 말 것.

**숫자 입력은 `Number(v) || 0`** 로 변환. 빈 문자열이 그대로 가면 `22P02`.

**월은 `'YYYY-MM-01'`**. `'2026-08'` 을 date 컬럼에 넣으면 `22007`.

**generated 컬럼**(`amount` `manufacturing_cost` `total_cost`)은 insert/update에 포함하면 에러.

**`tsc -b` 는 증분 캐시를 쓴다.** IDE와 결과가 다르면 `npx tsc -b --force`.

**`react-hooks/set-state-in-effect`** 는 함수 경계를 넘어 비동기성을 추적하지 못한다. 이펙트 안에서 `void (async () => { await fn() })()` 로 감싸면 통과.

---

## 9. 참고 문서

| 파일 | 내용 |
|---|---|
| `supabase/schema.sql` | **DB 전체 스키마 단일 파일** (가장 중요) |
| `docs/API.md` + `docs/api/00~06` | 함수별 API 명세 (§번호가 코드 주석과 연결됨) |
| `docs/OVERVIEW.md` | 구조·현황 (일부 낡음 — 수율 관련 서술은 무시) |
| `docs/SETUP.md` | 옛 5단계 셋업 절차 (`schema.sql` 로 대체됨) |
| `D:\카카오톡\sunshine-backend-design.md` | 팀 백엔드 설계서 (영웅이형 작성) |
| `D:\카카오톡\수불자료.xlsx` | 실제 양식 샘플 |

---

## 10. 다음 작업

1. **7번 마무리** — SQL 실행 + 생산량 입력 → 3단계 원가 계산 확인
2. **PDF 생성** — `pdfmake` 로 3단계 결과를 문서화 (사용자가 다음 목표로 지목)
3. 환율 — 외부 API 또는 수기 입력 (보류 중)
4. 커밋 안 된 변경이 쌓여 있음 (사용자 관리 연결, 권한 상승 수정, 사이드바, `schema.sql`)
