// Hojas botánicas decorativas: siempre aria-hidden, sin texto y con opacidad suave (ver .leaves en ui.css).
const colors = { clay: '#B8553F', mustard: '#E6A93F', sage: '#8A9A7E', plum: '#7A4F63', coral: '#D9805F' } as const
type Tone = keyof typeof colors
type LeafSpec = [x: number, y: number, rotate: number, scale: number, tone: Tone]

const blade = 'M0 0C20 -22 20 -70 0 -100C-20 -70 -20 -22 0 0Z'
function Leaf([x, y, rotate, scale, tone]: LeafSpec) {
  return <g key={`${x}-${y}-${rotate}`} transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}><path d={blade} fill={colors[tone]} /><path d="M0 -5V-82" stroke="#FFFAF3" strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" /></g>
}
function Branch({ stem, leaves, tone = 'sage' }: { stem: string; leaves: LeafSpec[]; tone?: Tone }) {
  return <><path d={stem} fill="none" stroke={colors[tone]} strokeWidth="3" strokeLinecap="round" />{leaves.map(Leaf)}</>
}

const left: LeafSpec[] = [[64, 385, -38, .7, 'sage'], [68, 352, 42, .66, 'clay'], [66, 312, -46, .82, 'mustard'], [78, 272, 40, .76, 'plum'], [72, 232, -42, .72, 'sage'], [78, 192, 36, .66, 'clay'], [70, 150, -32, .6, 'mustard'], [66, 106, 30, .56, 'sage'], [62, 62, -4, .5, 'clay']]
const right: LeafSpec[] = [[96, 392, 40, .74, 'plum'], [90, 350, -40, .7, 'sage'], [94, 308, 44, .84, 'clay'], [82, 266, -38, .78, 'mustard'], [90, 224, 40, .7, 'plum'], [84, 182, -42, .66, 'sage'], [90, 140, 34, .6, 'clay'], [94, 98, -28, .54, 'mustard'], [96, 56, 6, .48, 'sage']]
const corner: LeafSpec[] = [[170, 18, 70, .6, 'mustard'], [150, 50, 20, .7, 'clay'], [138, 62, 100, .62, 'sage'], [112, 96, 30, .66, 'plum'], [96, 108, 110, .56, 'mustard'], [70, 140, 40, .6, 'sage'], [50, 152, 120, .5, 'clay']]

export type LeavesVariant = 'left' | 'right' | 'corner' | 'cornerLeft'
/** Rama decorativa para márgenes (left, right) o esquinas (corner, cornerLeft). */
export function Leaves({ variant, className = '' }: { variant: LeavesVariant; className?: string }) {
  const common = { 'aria-hidden': true, focusable: false, className: `leaves leaves-${variant} ${className}`.trim() } as const
  if (variant === 'left') return <svg {...common} viewBox="0 0 160 420"><Branch stem="M70 420C58 320 92 200 62 40" leaves={left} /></svg>
  if (variant === 'right') return <svg {...common} viewBox="0 0 160 420"><Branch stem="M90 420C104 320 72 200 96 40" leaves={right} tone="plum" /></svg>
  return <svg {...common} viewBox="0 0 200 200" style={variant === 'cornerLeft' ? { transform: 'scaleX(-1)' } : undefined}><Branch stem="M196 0C150 40 100 90 46 160" leaves={corner} tone="plum" /></svg>
}

/** Fondo decorativo de las pantallas anchas: ramas en los márgenes, detrás del contenido y sin interacción. */
export function LeavesBackdrop() {
  return <div className="leaves-backdrop" aria-hidden="true"><Leaves variant="left" /><Leaves variant="right" /></div>
}

/** Brote en mostaza para estados vacíos. */
export function Sprout({ className = '' }: { className?: string }) {
  return <svg className={`sprout ${className}`.trim()} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
    <g fill={colors.mustard}><path d="M80 112C70 88 72 56 80 20C90 56 92 88 80 112Z" /><path transform="rotate(-34 80 112)" d="M80 112C68 90 70 60 80 34C92 62 92 90 80 112Z" /><path transform="rotate(34 80 112)" d="M80 112C68 90 70 60 80 34C92 62 92 90 80 112Z" /><path transform="rotate(-66 80 112)" d="M80 112C70 94 72 72 80 52C90 74 90 94 80 112Z" opacity=".8" /><path transform="rotate(66 80 112)" d="M80 112C70 94 72 72 80 52C90 74 90 94 80 112Z" opacity=".8" /></g>
    <g stroke={colors.mustard} strokeWidth="3" strokeLinecap="round"><path d="M126 26l8-12M144 52l12-6M34 26l-8-12M16 52l-12-6" /></g>
  </svg>
}
