import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './icons'
import './action-menu.css'

export type MenuAction = { label: string; icon?: IconName; danger?: boolean; onSelect: () => void }

/** Botón de menú (patrón WAI-ARIA «menu button»): flechas, Inicio y Fin mueven; Escape cierra y devuelve el foco; elegir una acción devuelve el foco al botón antes de ejecutarla. */
export function ActionMenu({ id, label, actions }: { id?: string; label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), items = useRef<(HTMLButtonElement | null)[]>([]), start = useRef(0), menuId = useId()
  useEffect(() => {
    if (!open) return
    items.current[start.current]?.focus()
    const down = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [open])
  const move = (to: number) => items.current[(to + actions.length) % actions.length]?.focus()
  const current = () => items.current.findIndex(item => item === document.activeElement)
  function triggerKeys(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); start.current = event.key === 'ArrowDown' ? 0 : actions.length - 1; setOpen(true) }
  }
  function menuKeys(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(current() + 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(current() - 1) }
    else if (event.key === 'Home') { event.preventDefault(); move(0) }
    else if (event.key === 'End') { event.preventDefault(); move(actions.length - 1) }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus() }
    else if (event.key === 'Tab') setOpen(false)
  }
  return <div ref={root} className="action-menu">
    <button ref={button} id={id} type="button" className="action-menu-button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => { start.current = 0; setOpen(!open) }} onKeyDown={triggerKeys}><Icon name="more" size={22} /></button>
    {open && <ul id={menuId} role="menu" aria-label={label} className="action-menu-panel" onKeyDown={menuKeys}>{actions.map((action, index) => <li key={action.label} role="none"><button ref={node => { items.current[index] = node }} type="button" role="menuitem" tabIndex={-1} className={action.danger ? 'is-danger' : undefined} onClick={() => { setOpen(false); button.current?.focus(); action.onSelect() }}>{action.icon && <Icon name={action.icon} size={20} />}{action.label}</button></li>)}</ul>}
  </div>
}
