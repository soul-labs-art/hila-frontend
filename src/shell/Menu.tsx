import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'

/** Menú desplegable (patrón disclosure): Escape lo cierra y devuelve el foco al botón; también se cierra al salir de él o al elegir una opción. */
export function Menu({ trigger, className = '', panelClass = '', children }: { trigger: ReactNode; className?: string; panelClass?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), id = useId()
  const close = useCallback((restore = true) => { setOpen(false); if (restore) button.current?.focus() }, [])
  useEffect(() => {
    if (!open) return
    const down = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open, close])
  return <div ref={root} className={`menu ${className}`.trim()} onBlur={event => { if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <button ref={button} type="button" className="menu-trigger" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{trigger}<Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} /></button>
    {open && <div id={id} className={`menu-panel ${panelClass}`.trim()} onClick={event => { if ((event.target as HTMLElement).closest('a, button')) close(false) }}>{children}</div>}
  </div>
}
