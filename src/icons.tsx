import type { ReactNode, SVGProps } from 'react'

const paths = {
  home: <path d="M3 11l9-8 9 8M5 9.5V20h14V9.5M10 20v-6h4v6" />,
  leaf: <path d="M5 19c0-8.5 5-14 15-14 0 10-5.5 15-14 15M5 19l8-8" />,
  document: <path d="M6 3h8l5 5v13H6zM14 3v5h5M9.5 13h6M9.5 17h6" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M16.5 14.2c2.7.1 4.5 2.2 4.5 5" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></>,
  userPlus: <><circle cx="10" cy="8" r="4" /><path d="M2.5 21c0-4 3.4-7 7.5-7M18 8v6M15 11h6" /></>,
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  gear: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16 9.5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.1" /></>,
  alert: <path d="M12 3.5l9.5 16.5h-19zM12 10v4.5M12 17.3v.1" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  clip: <path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  book: <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 8.5v.1" /></>,
  refresh: <path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" />,
  sprout: <path d="M12 21v-8M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 15.5c0-3.5 2.5-6 7-6 0 3.5-2.5 6-7 6z" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  trace: <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v3M6 14v3M12 5h8M12 12h6M12 19h8" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  more: <path d="M12 6v.1M12 12v.1M12 18v.1" strokeWidth="2.8" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths
export type IconProps = { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>

/** Icono de línea decorativo (24 px, trazo 1,75, hereda currentColor). Si comunica algo, acompáñalo de texto visible o aria-label en el control. */
export function Icon({ name, size = 24, className, ...props }: IconProps) {
  return <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>
}
