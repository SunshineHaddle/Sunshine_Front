import { useState, type FormEvent } from "react";
import { signIn, type LoginRole } from "../../lib/api/auth";

export type { LoginRole };

type LoginPageProps = {
  onLogin: (role: LoginRole, userName: string, loginId: string) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // §11-1 : 아이디 뒤에 내부 도메인을 붙여 Supabase Auth 로 로그인한다.
  // 세션이 생겨야 RLS 의 authenticated 정책이 적용된다.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    const result = await signIn(loginId, password);
    setBusy(false);

    if (result.ok) {
      onLogin(result.role, result.profile.name, result.profile.login_id);
      return;
    }
    setError(result.message);
  };

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="원가분석 프로그램 소개">
        <div className="login-intro__brand">원가분석 프로그램</div>
        <div className="login-intro__content">
          <p className="login-intro__eyebrow">COST MANAGEMENT</p>
          <h1>헷살 종합 식품</h1>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <header>
            <p>반갑습니다</p>
            <h2>로그인</h2>
            <span>계정 정보를 입력해 주세요.</span>
          </header>

          <div className="login-form__fields">
            <label>
              <span>아이디</span>
              <input
                aria-describedby="login-error"
                aria-invalid={Boolean(error)}
                autoComplete="username"
                autoFocus
                name="loginId"
                onChange={(event) => {
                  setLoginId(event.target.value);
                  setError("");
                }}
                placeholder="아이디를 입력하세요"
                required
                type="text"
                value={loginId}
              />
            </label>

            <label>
              <span>비밀번호</span>
              <input
                aria-describedby="login-error"
                aria-invalid={Boolean(error)}
                autoComplete="current-password"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="비밀번호를 입력하세요"
                required
                type="password"
                value={password}
              />
            </label>
          </div>

          <p className="login-form__error" id="login-error" role="alert">
            {error}
          </p>

          <button type="submit" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
        </form>
      </section>
    </main>
  );
}
