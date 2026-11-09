import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons'

/** Indicador de pasos. `current` es el índice (desde 0) del paso activo. */
export function Stepper({ steps, current, label = 'Progreso del perfil' }: { steps: string[]; current: number; label?: string }) {
  return <nav className="stepper" aria-label={label}><ol>{steps.map((step, index) => <li key={step} className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined}><span className="step-dot" aria-hidden="true">{index < current ? <Icon name="check" size={14} /> : index + 1}</span><span>{step}{index < current && <span className="sr-only"> (completado)</span>}</span></li>)}</ol></nav>
}

export type TabItem = { id: string; label: string; panel: ReactNode; badge?: ReactNode }
/** Pestañas WAI-ARIA: flechas, Inicio y Fin mueven y activan. Soporta uso controlado (value/onChange). */
export function Tabs({ tabs, label, defaultId, value, onChange }: { tabs: TabItem[]; label: string; defaultId?: string; value?: string; onChange?: (id: string) => void }) {
  const [inner, setInner] = useState(defaultId ?? tabs[0]?.id), active = value ?? inner, refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const select = (id: string) => { setInner(id); onChange?.(id); refs.current[id]?.focus() }
  function keys(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next >= 0) { event.preventDefault(); select(tabs[next].id) }
  }
  return <div className="tabs"><div role="tablist" aria-label={label}>{tabs.map((tab, index) => <button key={tab.id} ref={node => { refs.current[tab.id] = node }} role="tab" type="button" id={`tab-${tab.id}`} aria-selected={active === tab.id} aria-controls={`panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1} onClick={() => select(tab.id)} onKeyDown={event => keys(event, index)}>{tab.label}{tab.badge}</button>)}</div>{tabs.map(tab => <div key={tab.id} role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0}>{active === tab.id && tab.panel}</div>)}</div>
}

export type Crumb = { label: string; to?: string }
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return <nav className="breadcrumbs" aria-label="Migas de pan"><ol>{items.map((item, index) => <Fragment key={item.label}><li>{item.to && index < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>}</li>{index < items.length - 1 && <li aria-hidden="true" className="crumb-sep"><Icon name="chevronRight" size={14} /></li>}</Fragment>)}</ol></nav>
}
/** Enlace «← Volver a…». */
export function BackLink({ to, children }: { to: string; children: ReactNode }) { return <Link className="back-link" to={to}><Icon name="arrowLeft" size={18} />{children}</Link> }
