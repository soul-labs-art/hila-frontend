import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'

export type TimelineItem = { id: string; title: string; meta?: ReactNode; text?: ReactNode; tone?: 'ok' | 'wait' | 'no' | 'neutral' | 'plum'; icon?: IconName }
/** Línea de tiempo vertical con puntos de color; el título y la fecha llevan el significado, el color acompaña. */
export function Timeline({ items, label }: { items: TimelineItem[]; label?: string }) {
  return <ol className="timeline" aria-label={label}>{items.map(item => <li key={item.id} className={`tone-${item.tone ?? 'neutral'}`}><span className="timeline-icon" aria-hidden="true"><Icon name={item.icon ?? 'document'} size={20} /></span><div><strong>{item.title}</strong>{item.meta && <span className="timeline-meta">{item.meta}</span>}{item.text && <p>{item.text}</p>}</div></li>)}</ol>
}

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string }
/** Tabla con encabezado en mayúsculas pequeñas. El desplazamiento horizontal queda contenido en la propia tabla. */
export function DataTable<T>({ columns, rows, rowKey, caption, highlight }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption: string; highlight?: (row: T) => boolean }) {
  return <div className="table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="data-table"><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" className={column.className}>{column.header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={rowKey(row)} className={highlight?.(row) ? 'is-highlight' : undefined}>{columns.map(column => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>
}

export type Definition = { icon?: IconName; term: string; children: ReactNode }
/** Lista de datos con icono: término a la izquierda, valor a la derecha. */
export function DefinitionList({ items, className = '' }: { items: Definition[]; className?: string }) {
  return <dl className={`def-list ${className}`.trim()}>{items.map(item => <div key={item.term}>{item.icon ? <Icon name={item.icon} size={22} /> : <span />}<dt>{item.term}</dt><dd>{item.children}</dd></div>)}</dl>
}
