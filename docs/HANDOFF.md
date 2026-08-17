# 인수인계 — 헷살 원가분석 시스템

> 새 대화에 이 파일을 통째로 붙여넣으면 맥락이 전달된다.
> 2026-08-17 기준.

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
npm run lint    # 0 에러 유지
npx tsc -b --force
node src/lib/excel/parseQuantity.test.mjs   # 그 외 *.test.mjs 도 동일
```

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
[제품 상세]  12개월 단가 추이
```

값을 고치려면 **3단계 → 마감 취소 → 수정 → 다시 계산**.

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

**⑦ 2단계 배분은 생산량 비례를 쓴다**
`distributeByProduction()`. 미팅의 "경비는 생산량 기준 배분"과 일치한다.
`saveAutoCost`(재료비 비중 자동배분)도 구현돼 있으나 미사용.

**⑧ 엑셀 수량 칸의 단위를 검증한다**
`parseQuantity()` 가 숫자부와 단위부를 갈라 해석한다. g·톤은 kg으로 환산하고, 개·박스·L처럼 kg으로 바꿀 수 없는 단위는 **저장을 막는다**. 자세한 규칙은 [EXCEL.md](EXCEL.md).

---

## 5. RLS

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

> ⚠️ **읽기는 역할을 구분하지 않는다.** `read` 정책이 11개 테이블 전부에
> `using (true)` 로 걸려 있어, 실무자도 `product_cost_summaries` 를 읽을 수 있다.
> 화면에서만 가려져 있다. 미팅 요구와 어긋난다 — [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) §1 참고.

---

## 6. 연결 현황

**완료 — 테이블 11개 전부 + 뷰 2개 + Storage 2개**

| 화면 | 상태 |
|---|---|
| 로그인 / 세션 복구 / 로그아웃 | ✅ |
| 제품 관리 · 상세 · 생성 | ✅ (배합 수정, 이미지 업로드, 12개월 추이) |
| 데이터 입력 1·2·3단계 | ✅ |
| 대시보드 (수익성표 + 원가 추이 + PDF) | ✅ |
| 사용자 관리 (목록·역할·활성 토글·업로드 이력) | ✅ |
| 환율 산출 | ✅ 실시간 API + 제품 목록 연동 |

API 레이어: `src/lib/api/` — 자세한 목록은 [API.md](API.md).

**미구현 (미팅 요구 대비)** — [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) 참고.
선입선출 평균단가, 원자재/부자재 구분, 연말 합산, 레시피 불러오기.

---

## 7. 자주 걸리는 함정

**RLS는 읽기를 막을 때 에러를 내지 않는다.** `error: null` + 빈 배열. "데이터가 없다"와 구분이 안 된다. UPDATE도 0행 처리되므로, 반영 여부는 반환 행 수로 확인해야 한다.
**단, INSERT는 다르다** — `42501` 에러를 던진다. `describeDbError()` 가 한글로 바꿔준다.

**"마감된 달"이 가장 흔한 저장 실패 원인이다.** 관리자여도 막힌다(설계 의도).
`new row violates row-level security policy for table "material_usages"` 가 뜨면 권한이 아니라 `is_draft()` 에서 걸린 것. 3단계에서 마감을 취소해야 한다.

**로그인 전에 조회하면 anon으로 나간다.** 세션 복구가 끝나기 전에 fetch를 걸면 조용히 0행. `App.tsx` 의 데이터 이펙트는 `loginRole` 을 의존성에 두고 게이트한다.

**`signOut()` 은 해당 계정의 모든 세션을 무효화한다.** 스크립트로 테스트하면 브라우저 세션이 죽는다. 테스트용 클라이언트는 `persistSession: false` + signOut 생략.

**`.in('col', [])`** 는 `in.()` 문법 오류. 빈 배열이면 호출하지 말 것.

**숫자 입력은 `Number(v) || 0`** 로 변환. 빈 문자열이 그대로 가면 `22P02`.

**월은 `'YYYY-MM-01'`**. `'2026-08'` 을 date 컬럼에 넣으면 `22007`.

**generated 컬럼**(`amount` `manufacturing_cost` `total_cost`)은 insert/update에 포함하면 에러.

**`tsc -b` 는 증분 캐시를 쓴다.** IDE와 결과가 다르면 `npx tsc -b --force`.

**`react-hooks/set-state-in-effect`** 는 함수 경계를 넘어 비동기성을 추적하지 못한다. 이펙트 안에서 `void (async () => { await fn() })()` 로 감싸면 통과.
다만 **상태 미러링 자체가 냄새**인 경우가 많다. 환율 페이지는 `useMemo` 파생으로 바꿔 이펙트를 없앴다.

**프로젝트 안에 `tsconfig.json` 을 가진 폴더가 생기면 린트가 통째로 죽는다.**
`.claude/worktrees/` 잔재 때문에 87건이 전부 파싱 에러였던 적이 있다.
`eslint.config.js` 에 `tsconfigRootDir` 를 명시해 막아뒀다.

---

## 8. 참고 문서

| 파일 | 내용 |
|---|---|
| `supabase/schema.sql` | **DB 전체 스키마 단일 파일** (가장 중요) |
| [DATA-MODEL.md](DATA-MODEL.md) | 테이블·뷰·RPC·RLS 상세 |
| [API.md](API.md) | `src/lib/api/` 함수별 명세 |
| [EXCEL.md](EXCEL.md) | 수불자료 양식과 검증 규칙 |
| [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) | 미팅 요구사항 대비 현재 상태 |
| `D:\카카오톡\sunshine-backend-design.md` | 팀 백엔드 설계서 |
| `D:\카카오톡\수불자료.xlsx` | 실제 양식 샘플 |

---

## 9. 다음 작업

1. **3단계 원가 계산 실측** — 생산량을 실제 값으로 넣고 마감까지 통과시키기
   (포기김치 약 796,500kg / 맛김치 약 93,550kg)
2. **REQUIREMENTS-GAP 검토** — 선입선출 평균단가가 가장 큰 구멍
3. 판매가·`unit_weight_kg` 채우기 — 비어 있으면 마진율이 0% 또는 과대 계상
