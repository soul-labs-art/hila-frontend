// Formato y apoyo visual de las necesidades (oportunidades): fechas de Bogotá, territorios y foto de ambiente.
import type { Schemas } from './api/client'
import type { PhotoId } from './photos'

type Territory = Schemas['Territory']
const zone = 'America/Bogota'
const part = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CO', { timeZone: zone, ...options }).format(date)
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const clean = (value: string) => value.replace(/\./g, '').replace(/\s+/g, ' ').trim()

/** «Sáb. 24 oct.» */
export const shortDay = (iso: string) => { const date = new Date(iso); return `${cap(clean(part(date, { weekday: 'short' })))}. ${clean(part(date, { day: 'numeric', month: 'short' })).replace(' de ', ' ')}.` }
/** «Sábado 24 de octubre de 2026» */
export const longDay = (iso: string) => cap(part(new Date(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
export const clock = (iso: string) => part(new Date(iso), { hour: 'numeric', minute: '2-digit', hour12: false })
const sameDay = (a: string, b: string) => part(new Date(a), { dateStyle: 'short' }) === part(new Date(b), { dateStyle: 'short' })
/** «9:00 – 12:00», o con ambos días cuando la actividad cruza la medianoche. */
export const timeRange = (startsAt: string, endsAt: string) => sameDay(startsAt, endsAt) ? `${clock(startsAt)} – ${clock(endsAt)}` : `${clock(startsAt)} – ${shortDay(endsAt)} ${clock(endsAt)}`
/** Texto corto para tarjetas: «Sáb. 24 oct. · 9:00 – 12:00». */
export const whenLabel = (need: Pick<Schemas['PublicNeed'], 'startsAt' | 'endsAt'>) => `${shortDay(need.startsAt)} · ${timeRange(need.startsAt, need.endsAt)}`
export const isPast = (iso: string) => Date.parse(iso) <= Date.now()

/** Fecha de un campo `date` (AAAA-MM-DD) como instante de Bogotá (UTC-5, sin horario de verano). */
export const dayStart = (day: string) => `${day}T00:00:00-05:00`
export const dayEnd = (day: string) => `${day}T23:59:59-05:00`

export const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const proficiencyName = (value: string | null) => ({ BASIC: 'Básico', INTERMEDIATE: 'Intermedio', ADVANCED: 'Avanzado' })[value ?? ''] ?? 'Sin indicar'

export const placeLabel = (need: Pick<Schemas['PublicNeed'], 'modality' | 'territoryId' | 'publicLocationLabel'>, territories: Territory[]) => {
  if (need.modality === 'REMOTE') return 'Desde donde estés (remoto)'
  const area = territories.find(item => item.id === need.territoryId)?.name, label = need.publicLocationLabel
  return label && area && !label.toLowerCase().includes(area.toLowerCase()) ? `${label} · ${area}` : label || area || 'Lugar por confirmar'
}
export const slotsLabel = (need: Pick<Schemas['PublicNeed'], 'slotsAvailable' | 'slotsRequired'>) => need.slotsAvailable ? `${need.slotsAvailable} de ${need.slotsRequired} ${need.slotsRequired === 1 ? 'cupo disponible' : 'cupos disponibles'}` : 'Cupos completos'

/** Agrupa territorios para selectores y chips: municipios primero y, después, lo que hay dentro de cada uno. */
export function territoryGroups(territories: Territory[]) {
  const byId = new Map(territories.map(item => [item.id, item]))
  const groups: { label: string; items: Territory[] }[] = []
  const towns = territories.filter(item => item.type === 'MUNICIPALITY')
  if (towns.length) groups.push({ label: 'Municipios', items: towns })
  for (const parent of territories.filter(item => item.type === 'MUNICIPALITY' || item.type === 'COMMUNE')) {
    const children = territories.filter(item => item.parentId === parent.id && item.type !== 'MUNICIPALITY')
    if (children.length) groups.push({ label: parent.name, items: children })
  }
  const orphans = territories.filter(item => item.type !== 'MUNICIPALITY' && item.type !== 'VALLEY' && !(item.parentId && byId.has(item.parentId) && byId.get(item.parentId)!.type !== 'VALLEY'))
  if (orphans.length) groups.push({ label: 'Otros territorios', items: orphans })
  return groups
}

/** Foto de ambiente según el tema de la necesidad; no es de la actividad ni de la organización. */
export function needPhoto(need: Pick<Schemas['PublicNeed'], 'id' | 'title' | 'summary' | 'skills'>): PhotoId {
  const text = `${need.title} ${need.summary} ${need.skills.map(item => item.skill.name).join(' ')}`.toLowerCase()
  const pick = (options: PhotoId[]) => options[[...need.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % options.length]
  if (/huerta|siembra|cultiv|compost|semilla|árbol|jardin/.test(text)) return pick(['huerta-comunitaria-invernaderos', 'manos-plantulas-parterre', 'manos-siembra-tierra'])
  if (/lectura|libro|biblioteca|relato|escritura|tarea|escolar|memoria/.test(text)) return pick(['biblioteca-libro-manos', 'lectura-libro-manos'])
  if (/cocina|alimento|comida|almuerzo|mesa/.test(text)) return 'mesa-compartida'
  if (/fotograf|cartograf|mural|barrial|barrio|reciclaj/.test(text)) return pick(['fachadas-colores-medellin', 'ladera-barrio-medellin', 'tejados-ladera'])
  return pick(['valle-aburra-panoramica', 'montanas-antioquia-verde', 'ladera-bruma-medellin', 'tejados-ladera'])
}
