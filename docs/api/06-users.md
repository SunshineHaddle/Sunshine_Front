[← 목차](../API.md)

# 06. 사용자 · 인증

대상 테이블: `profiles`
대상 화면: 로그인, 사용자 관리

> **현재 `LoginPage`는 아이디·비밀번호가 하드코딩되어 있고 Supabase를 거치지 않는다.** 아래는 계정 연동 시점에 적용할 명세다. 연동 전까지는 [§0-5](00-common.md#0-5-rls-개발-중-임시-권한)의 임시 권한이 필요하다.

| 기능 | 대상 |
|---|---|
| [§11-1](#11-1-로그인) 로그인 | Auth |
| [§11-2](#11-2-세션-확인--로그아웃) 세션 확인 · 로그아웃 | Auth |
| [§11-3](#11-3-내-프로필-조회) 내 프로필 조회 | `profiles` |
| [§11-4](#11-4-사용자-목록-조회) 사용자 목록 조회 | `profiles` |
| [§11-5](#11-5-역할-변경--활성-토글) 역할 변경 · 활성 토글 | `profiles` |
| [§11-6](#11-6-마지막-접속-갱신) 마지막 접속 갱신 | `profiles` |
| [§11-7](#11-7-신규-사용자-추가--구현하지-않음) 신규 사용자 추가 | — 구현 안 함 |
| [§11-8](#11-8-계정--프로필-연결) 계정 ↔ 프로필 연결 | SQL |

---

## §11-1. 로그인 ✔️ `Auth`

Supabase Auth는 이메일 기준이므로, 아이디 입력 UI는 그대로 두고 뒤에 내부 도메인만 붙인다.

```ts
const { data, error } = await supabase.auth.signInWithPassword({
  email: `${loginId}@sunshine.local`,     // 'qwer1234' → 'qwer1234@sunshine.local'
  password,
})
```

필수:

* `email`
* `password`

동작:

```
1. 성공하면 세션이 localStorage 에 저장되고 이후 모든 호출이 authenticated 신분이 된다.
2. 실패해도 throw 되지 않는다. error.message 로 판별한다.
3. 로그인 후 profiles 를 조회해 role 을 확인하고 라우팅을 분기한다 (F-13).
```

error:

```json
{ "message": "Invalid login credentials", "status": 400 }
```

---

## §11-2. 세션 확인 · 로그아웃 ✔️ `Auth`

```ts
// 새로고침 후 세션 복구
const { data: { session } } = await supabase.auth.getSession()

// 세션 변화 구독
supabase.auth.onAuthStateChange((_event, session) => { /* … */ })

// 로그아웃
await supabase.auth.signOut()
```

동작:

```
1. getSession 은 비동기다. 초기 렌더에서 세션이 null 일 수 있으므로 로딩 상태를 둔다.
2. onAuthStateChange 구독은 언마운트 시 해제한다.
```

---

## §11-3. 내 프로필 조회 ✔️

로그인 직후 역할을 확인한다.

```ts
const { data, error } = await supabase
  .from('profiles')
  .select('id, login_id, name, role, is_active')
  .eq('id', session.user.id)
  .maybeSingle()
```

동작:

```
1. profiles 행이 없으면 null 이 온다.
   is_admin() 도 false 가 되어 쓰기가 전부 막히므로 원인을 찾기 어렵다.
2. auth.users 생성 후 profiles 행을 반드시 함께 만들어야 한다 (§11-8).
```

data:

```json
{ "id": "d4e5…", "login_id": "qwer1234", "name": "관리자",
  "role": "admin", "is_active": true }
```

---

## §11-4. 사용자 목록 조회 ✔️

사용자 관리 페이지. 기존 `buildInitialUsers` 하드코딩을 대체한다.

```ts
const { data, error } = await supabase
  .from('profiles')
  .select('id, login_id, name, role, is_active, last_active_at')
  .order('created_at')
```

필드:

```
role            'admin' | 'entry' | 'reviewer'
                화면 라벨은 시스템 관리자 / 데이터 입력 / 검토자
last_active_at  '마지막 접속' 표시용. null 이면 '초대 대기'
```

data:

```json
[
  { "id": "d4e5…", "login_id": "qwer1234", "name": "관리자",
    "role": "admin", "is_active": true, "last_active_at": "2026-08-09T04:12:00.000Z" },
  { "id": "f6a7…", "login_id": "worker1234", "name": "실무자",
    "role": "entry", "is_active": true, "last_active_at": null }
]
```

---

## §11-5. 역할 변경 · 활성 토글 ✔️

```ts
// 역할 변경
await supabase.from('profiles').update({ role: 'reviewer' }).eq('id', userId)

// 활성 / 비활성
await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', userId)
```

필수:

* `.eq('id', userId)`

동작:

```
1. RLS "admin write" 를 통과해야 한다. 관리자가 아니면 0행이 수정된다.
2. is_active=false 로 바꿔도 세션은 즉시 끊기지 않는다.
   is_admin() 이 false 가 되어 쓰기만 막힌다.
3. 마지막 관리자를 비활성화하면 아무도 쓰기를 못 하게 되므로 화면에서 막는다.
```

---

## §11-6. 마지막 접속 갱신 ✔️

로그인 성공 직후 호출한다. 기존 `dataEntryLog.ts`의 localStorage 기록을 대체한다.

```ts
await supabase
  .from('profiles')
  .update({ last_active_at: new Date().toISOString() })
  .eq('id', session.user.id)
```

> RLS `"update own profile"` 정책 덕분에 본인 행은 관리자가 아니어도 수정할 수 있다.

---

## §11-7. 신규 사용자 추가 — 구현하지 않음

계정 생성 기능은 만들지 않기로 한다. `auth.users` 생성에는 `service_role` 키가 필요한데, 이 키를 브라우저에 두면 RLS가 전부 무력화되기 때문이다.

계정이 필요하면 Supabase 대시보드(Authentication → Users → Add user)에서 직접 만들고 §11-8로 연결한다.

**할 일:** `UserManagementPage`의 "신규 사용자 추가" 버튼과 `addUser` 핸들러를 제거한다.

---

## §11-8. 계정 ↔ 프로필 연결 `SQL`

대시보드에서 계정을 만든 뒤 SQL Editor에서 한 번 실행한다.

```sql
insert into profiles (id, login_id, name, role)
select id,
       split_part(email, '@', 1),
       case when email like 'qwer%' then '관리자' else '실무자' end,
       case when email like 'qwer%' then 'admin'::user_role else 'entry'::user_role end
from auth.users
on conflict (id) do nothing;
```

동작:

```
1. auth.users 의 이메일 앞부분을 login_id 로 쓴다.
2. on conflict do nothing 이라 여러 번 실행해도 안전하다.
3. 계정을 추가할 때마다 다시 실행한다.
```

---

[← 05-files](05-files.md) · [목차](../API.md)
