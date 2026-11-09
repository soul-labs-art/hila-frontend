// Fechas y cifras de Mi actividad y Avisos, en hora de Bogotá.
import { clock } from './need-format'

const zone = 'America/Bogota'
const part = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CO', { timeZone: zone, ...options }).format(new Date(iso))
const clean = (value: string) => value.replace(/\./g, '').replace(/\s+/g, ' ').trim()
const dayNumber = (iso: string) => { const [year, month, day] = part(iso, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().map(Number); return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000) }

/** «18 oct. 2026» */
export const dayYear = (iso: string) => `${part(iso, { day: 'numeric' })} ${clean(part(iso, { month: 'short' }))}. ${part(iso, { year: 'numeric' })}`
/** «18 oct. 2026 · 9:15» */
export const dateTime = (iso: string) => `${dayYear(iso)} · ${clock(iso)}`
/** «Hoy · 9:15», «Ayer · 9:15», «Hace 3 días» o la fecha completa. */
export function ago(iso: string) {
  const days = dayNumber(new Date().toISOString()) - dayNumber(iso)
  return days === 0 ? `Hoy · ${clock(iso)}` : days === 1 ? `Ayer · ${clock(iso)}` : days > 1 && days < 7 ? `Hace ${days} días` : dayYear(iso)
}
/** «3 h», «2,5 h» */
export const hoursLabel = (hours: number) => `${hours.toLocaleString('es-CO', { maximumFractionDigits: 2 })} h`
export const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
