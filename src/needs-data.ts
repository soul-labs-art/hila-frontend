// Datos y reglas comunes de causas y necesidades de una organización (planned: solo con features.needs).
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { isPast } from './need-format'

export type Cause = Schemas['Cause']
export type Managed = Schemas['ManagedNeed']
export type Org = Schemas['Organization']
export type Tone = 'ok' | 'wait' | 'no' | 'neutral'

/** Recorre todas las páginas de una lista paginada del contrato. */
export async function everyPage<T>(path: string): Promise<T[]> {
  const items: T[] = []
  for (let page = 0; page < 20; page++) {
    const data = await api<{ items: T[]; totalPages: number }>(`${path}${path.includes('?') ? '&' : '?'}size=100&page=${page}`)
    items.push(...data.items); if (page + 1 >= data.totalPages) break
  }
  return items
}

export const orgQuery = (id: string) => ({ queryKey: ['organization', id], queryFn: () => api<Org>(`/organizations/${id}`), retry: false })
export const territoriesQuery = { queryKey: ['catalog', 'territories'], queryFn: () => api<Schemas['TerritoryPage']>('/catalogs/territories?size=100'), staleTime: 300_000, retry: false }
export const skillsAll = { queryKey: ['catalog', 'skills', 'all'], queryFn: () => everyPage<Schemas['Skill']>('/catalogs/skills'), staleTime: 300_000, retry: false }
export const resourcesAll = { queryKey: ['catalog', 'resources', 'all'], queryFn: () => everyPage<Schemas['Resource']>('/catalogs/resources'), staleTime: 300_000, retry: false }

/** Causas de la organización y todas sus necesidades. El contrato lista necesidades por causa, así que se piden por causa y se unen. */
export function useOrgWork(orgId: string) {
  const causes = useQuery({ queryKey: ['causes', orgId], queryFn: () => everyPage<Cause>(`/organizations/${orgId}/causes`), retry: false })
  const ids = causes.data?.map(item => item.id) ?? []
  const needs = useQuery({ queryKey: ['org-needs', orgId, ids.join(',')], enabled: !!causes.data, retry: false, queryFn: async () => (await Promise.all(ids.map(id => everyPage<Managed>(`/causes/${id}/needs`)))).flat() })
  return { causes, needs }
}
export const refreshWork = (client: QueryClient) => Promise.all(['causes', 'org-needs', 'need-management', 'needs', 'need'].map(key => client.invalidateQueries({ queryKey: [key] })))

/** Estado de una necesidad en lenguaje claro. Una publicada que ya terminó queda «Por cerrar». */
export function needLook(need: Pick<Managed, 'status' | 'endsAt'>): { label: string; tone: Tone; rank: number } {
  if (need.status === 'DRAFT') return { label: 'Borrador', tone: 'neutral', rank: 1 }
  if (need.status === 'PUBLISHED') return isPast(need.endsAt) ? { label: 'Por cerrar', tone: 'wait', rank: 0 } : { label: 'Publicada', tone: 'ok', rank: 2 }
  if (need.status === 'CLOSED') return { label: 'Cerrada', tone: 'neutral', rank: 3 }
  return { label: 'Cancelada', tone: 'no', rank: 4 }
}
export const causeLook = (status: Cause['status']): { label: string; tone: Tone } => status === 'ACTIVE' ? { label: 'Activa', tone: 'ok' } : status === 'ARCHIVED' ? { label: 'Archivada', tone: 'neutral' } : { label: 'Borrador', tone: 'neutral' }
export const isMember404 = (error: unknown) => error instanceof ApiFailure && (error.status === 404 || error.status === 403)


/** Mensaje de campo del contrato para controles que no usan Field. */
export const fieldMessage = (error: unknown, name: string) => error instanceof ApiFailure ? error.detail.fieldErrors?.filter(item => item.field === name).map(item => item.message).join(' ') : ''
/** Error de validación armado en el navegador, con la misma forma que el del servidor. */
export const clientFailure = (fieldErrors: { field: string; message: string }[]) => new ApiFailure(422, { code: 'VALIDATION_FAILED', message: 'Revisa los campos indicados.', fieldErrors: fieldErrors.map(item => ({ ...item, code: 'INVALID_FORMAT' })), traceId: '' })
/** Los campos de fecha y horario del formulario no se llaman como los del contrato: se traducen para que el error llegue a su control. */
export function remap(error: unknown) {
  if (!(error instanceof ApiFailure) || !error.detail.fieldErrors?.length) return error
  const rename = (field: string) => field === 'startsAt' ? 'date' : field === 'endsAt' ? 'endTime' : field.replace(/^(skills|resources)\[.*$/, '$1')
  return new ApiFailure(error.status, { ...error.detail, fieldErrors: error.detail.fieldErrors.map(item => ({ ...item, field: rename(item.field) })) })
}
