import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { Sprout } from '../Leaves'

/** Superficie base: tarjeta casi blanca con borde tenue y sombra suave. tone="soft" para zonas secundarias, "flat" sin sombra. */
export function Card({ as, tone = 'default', className = '', ...props }: { as?: ElementType; tone?: 'default' | 'soft' | 'flat' } & HTMLAttributes<HTMLElement>) {
  const Tag = as ?? 'div'
  return <Tag className={`card card-${tone} ${className}`.trim()} {...props} />
}

/** Aviso informativo (caja cálida con icono). No usa role: para anuncios dinámicos usa Feedback. */
export function Notice({ tone = 'info', icon, children, className = '' }: { tone?: 'info' | 'success' | 'warning'; icon?: IconName; children: ReactNode; className?: string }) {
  const name: IconName = icon ?? (tone === 'success' ? 'checkCircle' : tone === 'warning' ? 'alert' : 'info')
  return <div className={`notice notice-${tone} ${className}`.trim()}><Icon name={name} size={22} /><div>{children}</div></div>
}

/** Círculo con iniciales (no usamos retratos). Decorativo: el nombre debe estar en el texto vecino. */
export function Avatar({ name, size = 'md', tone, className = '' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: 'clay' | 'plum' | 'sage' | 'sun'; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
  const palette = tone ?? (['clay', 'plum', 'sage', 'sun'] as const)[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4]
  return <span className={`avatar avatar-${size} avatar-${palette} ${className}`.trim()} aria-hidden="true">{initials || '·'}</span>
}

/** Estado vacío amable con brote en mostaza. */
export function EmptyState({ title, headingLevel = 2, children, action, className = '' }: { title: string; headingLevel?: 1 | 2 | 3; children?: ReactNode; action?: ReactNode; className?: string }) {
  const Heading = `h${headingLevel}` as const
  return <section className={`empty-state ${className}`.trim()}><Sprout /><Heading>{title}</Heading>{children && <p>{children}</p>}{action && <div className="empty-action">{action}</div>}</section>
}
