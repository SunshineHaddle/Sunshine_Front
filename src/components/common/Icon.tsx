import type { ReactNode, SVGProps } from 'react'


export type IconName =
  | 'add'
  | 'bell'
  | 'bolt'
  | 'box'
  | 'calendar'
  | 'calculator'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'comparison'
  | 'dashboard'
  | 'data'
  | 'download'
  | 'droplet'
  | 'edit'
  | 'exchange'
  | 'excel'
  | 'filter'
  | 'factory'
  | 'help'
  | 'home'
  | 'info'
  | 'logout'
  | 'landmark'
  | 'more'
  | 'report'
  | 'search'
  | 'settings'
  | 'trend'
  | 'trash'
  | 'unlock'
  | 'upload'
  | 'users'

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number
}

const paths: Record<IconName, ReactNode> = {
  add: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7z" />,
  box: (
    <>
      <path d="M4 6h16v14H4z" />
      <path d="M3 3h18v4H3zM9 11h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  calculator: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m18 15-6-6-6 6" />,
  comparison: (
    <>
      <path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3" />
      <path d="m4 15 3-3 3 3" />
    </>
  ),
  dashboard: (
    <>
      <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />
    </>
  ),
  data: (
    <>
      <path d="M4 5h10M4 10h8M4 15h6" />
      <path d="m13.5 18.5 5.8-5.8 2 2-5.8 5.8-3 .9z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5M5 21h14" />
    </>
  ),
  droplet: <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  exchange: (
    <>
      <path d="M20 7a9 9 0 0 0-15.5-2L2 8" />
      <path d="M2 3v5h5M4 17a9 9 0 0 0 15.5 2l2.5-3" />
      <path d="M22 21v-5h-5" />
      <path d="M14.8 8.5c-.5-.8-1.4-1.3-2.8-1.3-1.7 0-2.8.9-2.8 2.1 0 3.2 5.8 1.4 5.8 4.5 0 1.3-1.1 2.2-3 2.2-1.5 0-2.5-.5-3.1-1.4M12 5.5v12" />
    </>
  ),
  excel: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="m9 13 4 5M13 13l-4 5" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V10l6 3V9l6 4V5h4l2 16z" />
      <path d="M7 17h.01M11 17h.01M15 17h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-1 .7-1.6 1.2-1.6 2.5M12 17h.01" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6M14 8l4 4-4 4M9 12h9" />
    </>
  ),
  landmark: (
    <>
      <path d="m3 9 9-5 9 5M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 18h16M3 21h18" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  report: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 16v-3M12 16V8M16 16v-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  trend: (
    <>
      <path d="M4 19V9M4 19h16" />
      <path d="m7 15 4-4 3 2 5-6" />
      <path d="M15 7h4v4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  unlock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  )
}
