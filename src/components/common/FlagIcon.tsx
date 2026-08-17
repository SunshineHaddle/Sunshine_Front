/**
 * 통화별 국기 아이콘.
 *
 * 이모지(🇺🇸)를 쓰면 Windows 에서 국기로 그려지지 않는다 —
 * 지역 표시 문자 조합을 지원하는 폰트가 없어서 'US' 같은 글자로 보인다.
 * 그래서 인라인 SVG 로 직접 그린다. 외부 요청도 없다.
 */
/** 그림이 준비된 통화. 그 외 코드는 회색 자리표시자로 그린다 */
export type FlagCode = 'USD' | 'JPY' | 'EUR' | 'CNY' | 'SAR' | 'AED'

type FlagIconProps = {
  /** 통화 코드. 사용자가 추가한 임의 코드도 들어올 수 있다 */
  code: string
  /** 가로 폭(px). 세로는 2:3 비율로 따라간다 */
  size?: number
  className?: string
}

/** 원 위에 균등 배치된 별(작은 원)의 좌표 */
function starRing(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

export function FlagIcon({ code, size = 20, className }: FlagIconProps) {
  const height = (size / 3) * 2
  const clipId = `flag-clip-${code}`

  const common = {
    width: size,
    height,
    viewBox: '0 0 24 16',
    role: 'img' as const,
    className,
    'aria-hidden': true,
  }

  if (code === 'JPY') {
    return (
      <svg {...common}>
        <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="24" height="16" fill="#fff" />
          <circle cx="12" cy="8" r="4.6" fill="#bc002d" />
        </g>
        <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    )
  }

  if (code === 'EUR') {
    return (
      <svg {...common}>
        <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="24" height="16" fill="#039" />
          {starRing(12, 8, 4.4, 12).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="0.72" fill="#fc0" />
          ))}
        </g>
        <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    )
  }

  if (code === 'CNY') {
    return (
      <svg {...common}>
        <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="24" height="16" fill="#de2910" />
          <circle cx="5" cy="4.6" r="2.1" fill="#ffde00" />
          <circle cx="9.4" cy="2.3" r="0.75" fill="#ffde00" />
          <circle cx="11.2" cy="4.4" r="0.75" fill="#ffde00" />
          <circle cx="11" cy="7.1" r="0.75" fill="#ffde00" />
          <circle cx="8.9" cy="8.9" r="0.75" fill="#ffde00" />
        </g>
        <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    )
  }

  if (code === 'SAR') {
    // 사우디 — 초록 바탕에 샤하다와 검. 이 크기에서 글자는 못 읽으므로 검만 남긴다
    return (
      <svg {...common}>
        <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="24" height="16" fill="#165d31" />
          <rect x="5" y="5.4" width="14" height="1" rx="0.5" fill="#fff" />
          <rect x="5" y="10" width="12.4" height="0.9" rx="0.45" fill="#fff" />
          <path d="M17.4 10.45 19.6 9.1v2.7z" fill="#fff" />
        </g>
        <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    )
  }

  if (code === 'AED') {
    // UAE — 왼쪽 빨강 세로띠 + 초록·흰색·검정 가로 3줄
    return (
      <svg {...common}>
        <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width="24" height="5.334" y="0" fill="#00732f" />
          <rect width="24" height="5.334" y="5.334" fill="#fff" />
          <rect width="24" height="5.334" y="10.668" fill="#000" />
          <rect width="6" height="16" fill="#ff0000" />
        </g>
        <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    )
  }

  if (code !== 'USD') {
    // 사용자가 추가한 통화 등 그림이 없는 코드. 앞 두 글자를 보여준다
    return (
      <svg {...common}>
        <rect width="24" height="16" rx="2" fill="#eceaea" stroke="rgba(0,0,0,.12)" />
        <text
          x="12"
          y="11.2"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#8b8285"
        >
          {code.slice(0, 2).toUpperCase()}
        </text>
      </svg>
    )
  }

  // USD — 13줄 줄무늬와 50개 별은 이 크기에서 뭉개진다. 7줄 + 별 8개로 줄인다
  return (
    <svg {...common}>
      <clipPath id={clipId}><rect width="24" height="16" rx="2" /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect width="24" height="16" fill="#fff" />
        {/* 빨간 줄 7개 사이에 흰 배경이 비쳐 13줄처럼 보인다 */}
        <g fill="#b22234">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} y={i * 2.462} width="24" height="1.231" />
          ))}
        </g>
        <rect width="10" height="8.6" fill="#3c3b6e" />
        {[
          [2, 2], [5, 2], [8, 2],
          [3.5, 4.3], [6.5, 4.3],
          [2, 6.6], [5, 6.6], [8, 6.6],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.62" fill="#fff" />
        ))}
      </g>
      <rect width="24" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
    </svg>
  )
}
