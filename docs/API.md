# API 명세서 — 해뜰 종합식품 원가분석

Supabase(PostgREST) 기반. 별도 백엔드 서버 없이 프론트엔드에서 `supabase-js`로 직접 호출한다.

## 문서 구성

| 파일 | 내용 | 언제 보나 |
|---|---|---|
| [00-common.md](api/00-common.md) | 클라이언트 설정, 응답 규약, 에러 코드, RLS | **가장 먼저.** 막히면 다시 |
| [01-frontend.md](api/01-frontend.md) | API 없이 프론트가 처리하는 일 (F-1~F-14), 엑셀 파이프라인 | 환율·PDF·엑셀·계산 로직 |
| [02-products.md](api/02-products.md) | 원재료, 제품, 배합 | 제품 관리·상세·생성 화면 |
| [03-cost-entry.md](api/03-cost-entry.md) | 월 회차, 생산량, 투입 실적, 운영비 | 데이터 입력 1·2단계 |
| [04-results.md](api/04-results.md) | 월 마감, 수익성, 원가 추이 | 3단계, 대시보드 |
| [05-files.md](api/05-files.md) | 엑셀 원본 보관, 업로드 이력 | 파일 이력 화면 |
| [06-users.md](api/06-users.md) | 로그인, 프로필, 권한 | 로그인, 사용자 관리 |

## 시스템 구성

| 구분 | 개수 | 이름 |
|---|---|---|
| 테이블 | 11 | `profiles` `materials` `products` `recipe_items` `material_usages` `cost_periods` `production_records` `operating_costs` `operating_cost_allocations` `product_cost_summaries` `file_uploads` |
| 뷰 | 2 | `v_product_recipe_cost` `v_cost_trend_monthly` |
| RPC | 2 | `create_product_with_recipe` `confirm_period` |
| Storage | 2 | `product-images` (Public) `excel-uploads` (Private) |

> 기능 항목이 30여 개인 것은 테이블 하나에 조회·저장·수정·삭제가 각각 붙기 때문이다. 테이블 수와 다르다.

---

## 찾아보기 ① 테이블별

| 테이블 / 뷰 | 기능 | 문서 |
|---|---|---|
| `materials` | §2-1 목록 · §2-2 등록 | [02](api/02-products.md) |
| `products` | §3-1 목록 · §3-2 상세 · §3-3 생성 · §3-4 수정 · §3-5 이미지 · §3-7 비활성화 | [02](api/02-products.md) |
| `recipe_items` | §3-2 조회 · §3-3 생성 · §3-6 수정 · §9-3 집계 | [02](api/02-products.md), [04](api/04-results.md) |
| `cost_periods` | §4-1 확보 · §4-2 목록 | [03](api/03-cost-entry.md) |
| `production_records` | §5-1 조회 · §5-2 저장 | [03](api/03-cost-entry.md) |
| `material_usages` | §6-1 조회 · §6-2 저장 · §6-3 삭제 | [03](api/03-cost-entry.md) |
| `operating_costs` | §7-1 조회 · §7-2 저장 · §7-3 삭제 | [03](api/03-cost-entry.md) |
| `operating_cost_allocations` | §7-1 조회 · §7-2 저장 | [03](api/03-cost-entry.md) |
| `product_cost_summaries` | §8-1 확정 · §8-2 조회 · §9-2 추이 | [04](api/04-results.md) |
| `v_cost_trend_monthly` | §9-1 원가 추이 | [04](api/04-results.md) |
| `v_product_recipe_cost` | §9-3 표준 재료비 | [04](api/04-results.md) |
| `file_uploads` | §10-2 기록 · §10-3 목록 · §10-5 삭제 | [05](api/05-files.md) |
| `profiles` | §11-3~§11-6 조회·수정 · §11-8 연결 | [06](api/06-users.md) |

## 찾아보기 ② 화면별

| 화면 | 호출 | 프론트 처리 |
|---|---|---|
| 로그인 | §11-1 §11-2 §11-3 §11-6 | F-13 |
| 대시보드 | §8-2 §9-1 §9-3 | F-2 F-12 F-14 |
| 제품 관리 | §3-1 §3-7 | F-4 F-12 |
| 제품 상세 | §3-2 §3-4 §3-5 §3-6 §9-2 | F-4 F-12 |
| 제품 생성 | §2-1 §2-2 §3-3 | F-9 |
| 데이터 입력 1단계 | §4-1 §5-1 §5-2 §6-2 §10-1 §10-2 §12-2 | F-3 F-10 F-11 |
| 데이터 입력 2단계 | §4-1 §7-1 §7-2 §7-3 | F-5 F-6 F-7 F-10 |
| 데이터 입력 3단계 | §8-1 §8-2 | F-2 F-12 |
| 환율 산출 | §3-1 | F-1 F-8 F-12 |
| 사용자 관리 | §11-4 §11-5 | — |
| 파일 이력 | §10-3 §10-4 §10-5 | — |

## 찾아보기 ③ 프론트 전담 (API 없음)

| # | 기능 | 방식 |
|---|---|---|
| F-1 | 환율 조회 | 외부 API `fetch` |
| F-2 | PDF 생성 | `pdfmake` |
| F-3 | 엑셀 파싱 | `SheetJS(xlsx)` |
| F-4 | 재료비·재료 개수 합산 | `reduce` |
| F-5 | 인건비 % → 금액 환산 | 계산 후 저장 |
| F-6 | 배분 비율 100% 검증 | 기존 로직 유지 |
| F-7 | 균등 분배 | 기존 로직 유지 |
| F-8 | 판매가·현지가 계산 | 계산 |
| F-9 | 원가 미리보기 | 계산 |
| F-10 | 월 문자열 변환 | `'2026-08'` ↔ `'2026-08-01'` |
| F-11 | 미입력 제품 행 병합 | 좌측 조인 |
| F-12 | 숫자·통화 포맷 | `Intl.NumberFormat` |
| F-13 | 권한별 라우팅 가드 | 기존 로직 유지 |
| F-14 | 차트 축 라벨 | 계산 |

상세는 [01-frontend.md](api/01-frontend.md).

---

## 부록. 표준원가 vs 실제원가

재료비를 구하는 두 경로를 모두 지원한다.

| 구분 | 테이블 | 의미 | 재료비 계산 |
|---|---|---|---|
| 표준원가 | `recipe_items` | 제품 1단위 기준 배합 | `Σ(usage × unit_price) × 생산량` |
| 실제원가 | `material_usages` | 그 달 실제 투입량 | `Σ(usage × unit_price)` |

`confirm_period`(§8-1)의 판단:

```
해당 월 material_usages 에 그 제품 행이 있으면  → 실제원가 (cost_source='actual')
없으면                                         → 표준원가 (cost_source='standard')
```

| 화면 | 사용 |
|---|---|
| 제품 생성·상세 | `recipe_items` — 생산 전이라 표준만 존재 |
| 1단계 엑셀 업로드 | `material_usages` — 실적을 파싱해 적재 |
| 3단계 결과 | 실적 우선, 없으면 표준 |
| 대시보드 | 스냅샷의 `cost_source`로 근거 표시 |

> 기존 목데이터 `poggiIngredients`(배추 606,248kg)는 **월 전체 투입량**이므로 `material_usages` 쪽이다. `recipe_items`에는 1포기 기준 배합(배추 5kg 등)을 넣는다.
