import { useState, type FormEvent } from 'react'

const ADMIN_LOGIN_ID = 'qwer1234'
const WORKER_LOGIN_ID = 'worker1234'
const LOGIN_PASSWORD = '0000'

export type LoginRole = 'admin' | 'worker'

type LoginPageProps = {
  onLogin: (role: LoginRole) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const role = loginId === ADMIN_LOGIN_ID
      ? 'admin'
      : loginId === WORKER_LOGIN_ID
        ? 'worker'
        : null

    if (role && password === LOGIN_PASSWORD) {
      onLogin(role)
      return
    }

    setError('아이디 또는 비밀번호를 확인해 주세요.')
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="원가분석 프로그램 소개">
        <div className="login-intro__brand">원가분석 프로그램</div>
        <div className="login-intro__content">
          <p className="login-intro__eyebrow">COST MANAGEMENT</p>
          <h1>
            원가를 읽으면,
            <br />
            다음 결정이 선명해집니다.
          </h1>
          <p>원재료비부터 생산 결과까지, 모든 원가 정보를 한눈에 관리하세요.</p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
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
                  setLoginId(event.target.value)
                  setError('')
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
                  setPassword(event.target.value)
                  setError('')
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

          <button type="submit">로그인</button>
        </form>
      </section>
    </main>
  )
}
