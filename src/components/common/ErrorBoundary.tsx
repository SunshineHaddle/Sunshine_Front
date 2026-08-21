import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 렌더링 중 터진 예외를 잡아 안내 화면으로 바꾼다.
 *
 * 이게 없으면 React 가 트리 전체를 언마운트해서 **아무것도 없는 흰 화면**이 된다.
 * 사용자는 뭐가 잘못됐는지, 새로고침하면 되는지조차 알 수 없다.
 *
 * 이벤트 핸들러나 비동기 안에서 난 오류는 잡지 못한다 — 그쪽은
 * 각 화면의 try/catch 와 `describeDbError()` 가 맡는다.
 */
type ErrorBoundaryProps = { children: ReactNode }
type ErrorBoundaryState = { error: Error | null }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 배포본에서는 콘솔이 유일한 단서다. 컴포넌트 경로까지 남긴다
    console.error('[화면 오류]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app-crash" role="alert">
        <div className="app-crash__box">
          <h1>화면을 표시하지 못했습니다</h1>
          <p>
            새로고침하면 대부분 해결됩니다.
            <br />
            같은 문제가 반복되면 아래 내용을 담당자에게 알려주세요.
          </p>
          {/* 원문을 그대로 보여준다. 요약하면 원인을 찾을 단서가 사라진다 */}
          <pre className="app-crash__detail">{error.message}</pre>
          <div className="app-crash__actions">
            <button type="button" onClick={() => window.location.reload()}>
              새로고침
            </button>
            <button
              type="button"
              className="is-quiet"
              onClick={() => this.setState({ error: null })}
            >
              그냥 닫기
            </button>
          </div>
        </div>
      </div>
    )
  }
}
