// Datos y reglas comunes de postulaciones y cierre vistos desde el equipo de la organización (planned: features.applications y features.participation).
import { useSyncExternalStore } from 'react'
import { type QueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { everyPage, refreshWork, type Managed, type Tone } from './needs-data'
import { clock, weekdays } from './need-format'
import type { IconName } from './icons'

export type OrgApplication = Schemas['OrganizationApplication']
export type Participation = Schemas['Participation']
export type Evidence = Schemas['Evidence']

export const managedQuery = (needId: string) => ({ queryKey: ['need-management', needId], queryFn: () => api<Managed>(`/needs/${needId}/management`), retry: false })
/** Todas las postulaciones de una necesidad (el contrato las pagina; son pocas, así que se unen y se filtran aquí). */
export const needApplications = (needId: string) => ({ queryKey: ['need-applications', needId], queryFn: () => everyPage<OrgApplication>(`/needs/${needId}/applications`), retry: false })
export const participationOf = (applicationId: string, enabled = true) => ({ queryKey: ['participation', applicationId], enabled, retry: false, queryFn: async () => { try { return await api<Participation>(`/applications/${applicationId}/participation`) } catch (error) { if (error instanceof ApiFailure && error.status === 404) return null; throw error } } })
export const refreshTeam = (client: QueryClient) => Promise.all([refreshWork(client), ...['need-applications', 'application', 'participation', 'feedback', 'evidence', 'my-applications', 'notifications', 'unread-count'].map(key => client.invalidateQueries({ queryKey: [key] }))])

/** Pantalla ancha: lista y detalle lado a lado. Con menos de 960 px se muestra una cosa a la vez. */
export function useWide() {
  return useSyncExternalStore(callback => { const query = window.matchMedia('(min-width: 960px)'); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback) }, () => window.matchMedia('(min-width: 960px)').matches, () => true)
}

export type Stage = 'review' | 'confirm' | 'confirmed' | 'closed'
export type Look = { label: string; tone: Tone; icon: IconName; stage: Stage }
/** Estado de la postulación para quien la revisa. El texto siempre dice el estado; color e icono solo acompañan. */
export function appLook(app: Pick<OrgApplication, 'status' | 'commitmentStatus'>): Look {
  if (app.status === 'APPLIED') return { label: 'Por revisar', tone: 'wait', icon: 'clock', stage: 'review' }
  if (app.status === 'REJECTED') return { label: 'Rechazada', tone: 'no', icon: 'x', stage: 'closed' }
  if (app.status === 'WITHDRAWN') return { label: 'Retirada', tone: 'neutral', icon: 'x', stage: 'closed' }
  if (app.commitmentStatus === 'NOT_CONFIRMED') return { label: 'Aceptada, falta confirmar', tone: 'wait', icon: 'clock', stage: 'confirm' }
  if (app.commitmentStatus === 'CONFIRMED') return { label: 'Confirmada', tone: 'ok', icon: 'checkCircle', stage: 'confirmed' }
  if (app.commitmentStatus === 'COMPLETED') return { label: 'Participó', tone: 'ok', icon: 'check', stage: 'closed' }
  if (app.commitmentStatus === 'NO_SHOW') return { label: 'No asistió', tone: 'no', icon: 'alert', stage: 'closed' }
  return { label: 'Compromiso cancelado', tone: 'neutral', icon: 'x', stage: 'closed' }
}
export const stageRank: Record<Stage, number> = { review: 0, confirm: 1, confirmed: 2, closed: 3 }
export const byStage = (a: OrgApplication, b: OrgApplication) => stageRank[appLook(a).stage] - stageRank[appLook(b).stage] || b.appliedAt.localeCompare(a.appliedAt)
/** Compromisos que cuentan para el cierre: confirmados o ya registrados. */
export const isCommitted = (app: OrgApplication) => app.status === 'ACCEPTED' && (app.commitmentStatus === 'CONFIRMED' || app.commitmentStatus === 'COMPLETED' || app.commitmentStatus === 'NO_SHOW')
export const counts = (apps: OrgApplication[]) => ({ review: apps.filter(app => appLook(app).stage === 'review').length, confirm: apps.filter(app => appLook(app).stage === 'confirm').length, confirmed: apps.filter(app => appLook(app).stage === 'confirmed').length, missing: apps.filter(app => app.status === 'ACCEPTED' && app.commitmentStatus === 'CONFIRMED').length })

const zone = 'America/Bogota'
const parts = (iso: string) => { const date = new Date(iso); return { weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(date)), day: new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date), time: new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) } }
const plural = (day: string) => day.toLowerCase().replace(/(?<![s])$/, 's')
const short = (time: string) => time.replace(/^0/, '')

/** Cómo encaja lo que la persona indicó en su perfil con lo que pide la necesidad. Es solo lectura de sus datos: la decisión es de la organización. */
export function fitOf(app: OrgApplication, need: Managed, territoryName?: string) {
  const mine = new Set(app.applicant.skills.map(item => item.skill.id)), asked = [...need.skills].sort((a, b) => Number(b.required) - Number(a.required))
  const skills = asked.map(item => ({ id: item.skill.id, name: item.skill.name, required: item.required, has: mine.has(item.skill.id) }))
  const start = parts(need.startsAt), end = parts(need.endsAt), day = weekdays[start.weekday]
  let schedule: { tone: 'ok' | 'wait' | 'neutral'; text: string }
  if (start.day !== end.day) schedule = { tone: 'neutral', text: 'La actividad cruza la medianoche: revisa su horario con la persona.' }
  else {
    const slots = app.applicant.availability.items.filter(slot => slot.weekday === start.weekday + 1), when = `${day.toLowerCase()}, ${clock(need.startsAt)} – ${clock(need.endsAt)}`
    const covers = slots.find(slot => slot.startsAt <= start.time && slot.endsAt >= end.time)
    schedule = covers ? { tone: 'ok', text: `Indicó que puede los ${plural(day)} de ${short(covers.startsAt)} a ${short(covers.endsAt)}: cubre la actividad (${when}).` }
      : slots.length ? { tone: 'wait', text: `Indicó ${plural(day)} de ${slots.map(slot => `${short(slot.startsAt)} a ${short(slot.endsAt)}`).join(' y ')}, que no cubre toda la actividad (${when}).` }
        : { tone: 'neutral', text: `No indicó disponibilidad para ${plural(day)} (${when}).` }
  }
  const inArea = !!need.territoryId && app.applicant.serviceAreas.some(area => area.id === need.territoryId)
  const place = need.modality === 'REMOTE' ? { tone: 'neutral' as const, text: 'La actividad es remota: no depende de la zona.' } : inArea ? { tone: 'ok' as const, text: `Indicó que puede acompañar en ${territoryName ?? 'esta zona'}.` } : { tone: 'neutral' as const, text: `No indicó ${territoryName ?? 'esta zona'} entre sus zonas de servicio.` }
  return { skills, schedule, place }
}

/** Baja una evidencia con su enlace temporal firmado (vigente un minuto). */
export async function downloadEvidence(evidence: Evidence) {
  const link = await api<Schemas['EvidenceDownload']>(`/evidence/${evidence.id}/download-url`), anchor = document.createElement('a')
  anchor.href = link.url; anchor.download = evidence.originalFilename; anchor.rel = 'noopener'; document.body.append(anchor); anchor.click(); anchor.remove()
}
