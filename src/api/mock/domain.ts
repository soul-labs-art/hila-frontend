// Lógica compartida por las operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../client'
import { Fail, invalid, notFound } from './errors'
import { db } from './store'
import type { Account, Capacities, NeedRecord } from './types'
import { now, uid } from './util'
import { findOrganization, membershipOf, readableOrganization, territoryById } from './views'

type Proficiency = NonNullable<Schemas['VolunteerSkillInput']['proficiency']>
const rank: Record<Proficiency, number> = { BASIC: 1, INTERMEDIATE: 2, ADVANCED: 3 }
const DAY = 86_400_000, OFFSET = 5 * 3_600_000, uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* Identificadores, consultas y orden */
export function uuid(value: string) { if (!uuidPattern.test(value)) throw new Fail(400, 'MALFORMED_REQUEST', 'El identificador no es válido.'); return value }
export const byName = <T extends { name: string; id: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
export const newest = <T extends { id: string }>(items: T[], date: (item: T) => string) => [...items].sort((a, b) => date(b).localeCompare(date(a)) || b.id.localeCompare(a.id))
export function flagParam(query: URLSearchParams, name: string) {
  const raw = query.get(name)
  if (raw === null) return null
  if (raw !== 'true' && raw !== 'false') throw new Fail(400, 'MALFORMED_REQUEST', `El parámetro «${name}» no es válido.`)
  return raw === 'true'
}
export function enumParam<T extends string>(query: URLSearchParams, name: string, values: readonly T[]) {
  const raw = query.get(name)
  if (raw === null) return null
  if (!(values as readonly string[]).includes(raw)) throw new Fail(400, 'MALFORMED_REQUEST', `El parámetro «${name}» no es válido.`)
  return raw as T
}
export function idParam(query: URLSearchParams, name: string) { const raw = query.get(name); return raw === null ? null : uuid(raw) }
export function dateParam(query: URLSearchParams, name: string) {
  const raw = query.get(name)
  if (raw === null) return null
  const value = Date.parse(raw)
  if (Number.isNaN(value) || !/\d{4}-\d{2}-\d{2}T/.test(raw)) throw new Fail(400, 'MALFORMED_REQUEST', `El parámetro «${name}» no es una fecha válida.`)
  return value
}
export function ordered(from: number | null, to: number | null, field: string) {
  if (from !== null && to !== null && from > to) throw invalid({ field, code: 'OUT_OF_RANGE', message: 'El intervalo está invertido: la fecha inicial es posterior a la final.' })
}
export const matches = (text: string, term: string | null) => !term || text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(term.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())

/* Auditoría y notificaciones */
export function audit(actorUserId: string | null, action: string, resourceType: string, resourceId: string | null) {
  db().audit.push({ id: uid(), actorUserId, action, resourceType, resourceId, occurredAt: now() })
}
export function notify(userId: string, type: Schemas['Notification']['type'], title: string, body: string, resourceType: Schemas['Notification']['resourceType'], resourceId: string | null) {
  db().notifications.push({ id: uid(), userId, type, title, body, resourceType, resourceId, createdAt: now(), readAt: null })
}
export const teamOf = (organizationId: string) => db().memberships.filter(item => item.organizationId === organizationId && item.status === 'ACTIVE').map(item => item.userId)
export const accountById = (id: string) => db().accounts.find(item => item.id === id)

/* Capacidades del perfil voluntario */
export const capacitiesOf = (account: Account): Capacities => account.capacities ??= { skills: [], availability: [], serviceAreas: [], resources: [] }
export function skillsOf(account: Account): Schemas['VolunteerSkill'][] {
  return capacitiesOf(account).skills.flatMap(item => { const skill = db().skills.find(entry => entry.id === item.skillId); return skill ? [{ skill, proficiency: item.proficiency, yearsExperience: item.yearsExperience }] : [] })
    .sort((a, b) => a.skill.name.localeCompare(b.skill.name, 'es'))
}
export function resourcesOf(account: Account): Schemas['VolunteerResource'][] {
  return capacitiesOf(account).resources.flatMap(item => { const resource = db().resources.find(entry => entry.id === item.resourceId); return resource ? [{ resource, details: item.details }] : [] })
    .sort((a, b) => a.resource.name.localeCompare(b.resource.name, 'es'))
}
export const areasOf = (account: Account): Schemas['Territory'][] => byName(capacitiesOf(account).serviceAreas.flatMap(id => territoryById(id) ?? []))
export const availabilityOf = (account: Account): Schemas['Availability'] => ({ timezone: 'America/Bogota', items: [...capacitiesOf(account).availability].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)) })
export function applicantOf(account: Account): Schemas['Applicant'] {
  const { biography, profession, educationLevel, preferredModality } = account.profile!
  return { userId: account.id, displayName: account.displayName, profile: { biography, profession, educationLevel, preferredModality }, skills: skillsOf(account), availability: availabilityOf(account), serviceAreas: areasOf(account), resources: resourcesOf(account) }
}
/** Errores de campo para listas de referencias a catálogos: duplicados, inexistentes e inactivos (salvo los que ya estaban asociados). */
export function catalogErrors(catalog: { id: string; active: boolean }[], ids: string[], path: (index: number) => string, previous: string[] = []) {
  const errors: Schemas['FieldError'][] = [], seen = new Set<string>()
  ids.forEach((id, index) => {
    const entry = catalog.find(item => item.id === id)
    if (seen.has(id)) errors.push({ field: path(index), code: 'DUPLICATE', message: 'Este elemento está repetido.' })
    else if (!entry) errors.push({ field: path(index), code: 'INVALID_REFERENCE', message: 'Elige una opción del catálogo.' })
    else if (!entry.active && !previous.includes(id)) errors.push({ field: path(index), code: 'INACTIVE_REFERENCE', message: 'Esta opción ya no está disponible en el catálogo.' })
    seen.add(id)
  })
  return errors
}

/* Territorios */
export function lineage(id: string | null) {
  const chain: string[] = []
  for (let current = territoryById(id); current && !chain.includes(current.id); current = territoryById(current.parentId)) chain.push(current.id)
  return chain
}

/* Necesidades, causas y acceso */
export const findCause = (id: string) => { const cause = db().causes.find(item => item.id === uuid(id)); if (!cause) throw notFound(); return cause }
export const findNeed = (id: string) => { const need = db().needs.find(item => item.id === uuid(id)); if (!need) throw notFound(); return need }
export const findApplication = (id: string) => { const application = db().applications.find(item => item.id === uuid(id)); if (!application) throw notFound(); return application }
export const findParticipation = (id: string) => { const participation = db().participations.find(item => item.id === uuid(id)); if (!participation) throw notFound(); return participation }
export const causeOf = (need: NeedRecord) => db().causes.find(item => item.id === need.causeId)!
export const orgOfNeed = (need: NeedRecord) => findOrganization(causeOf(need).organizationId)
export const needOf = (application: Schemas['Application']) => findNeed(application.needId)
export const participationOf = (application: Schemas['Application']) => db().participations.find(item => item.applicationId === application.id)
export const summary = (org: Schemas['Organization']): Schemas['OrganizationSummary'] => ({ id: org.id, name: org.name, organizationType: org.organizationType })
const reservedStatuses: Schemas['CommitmentStatus'][] = ['CONFIRMED', 'COMPLETED', 'NO_SHOW']
export const reserved = (needId: string) => db().applications.filter(item => item.needId === needId && reservedStatuses.includes(item.commitmentStatus)).length
export const slotsAvailable = (need: NeedRecord) => Math.max(0, need.slotsRequired - reserved(need.id))
export const interested = (needId: string) => db().applications.filter(item => item.needId === needId && (item.status === 'APPLIED' || item.status === 'ACCEPTED')).map(item => item.volunteerId)
export const needTerms = (need: NeedRecord) => ({ skills: need.skills.flatMap(item => { const skill = db().skills.find(entry => entry.id === item.skillId); return skill ? [{ skill, required: item.required, minimumProficiency: item.minimumProficiency }] : [] }),
  resources: need.resources.flatMap(item => { const resource = db().resources.find(entry => entry.id === item.resourceId); return resource ? [{ resource, required: item.required, details: item.details }] : [] }) })
export function managedView(need: NeedRecord): Schemas['ManagedNeed'] { return { ...need, organization: summary(orgOfNeed(need)), slotsAvailable: slotsAvailable(need), ...needTerms(need) } }
export function publicView(need: NeedRecord): Schemas['PublicNeed'] {
  const { privateLocationInstructions: _private, createdBy: _author, createdAt: _created, ...rest } = managedView(need)
  return { ...rest, outcome: need.outcome ? { status: need.outcome.status } : null }
}
/** Visible en el catálogo público: publicada, organización aprobada y causa activa. */
export const listed = (need: NeedRecord) => need.status === 'PUBLISHED' && orgOfNeed(need).verificationStatus === 'APPROVED' && causeOf(need).status === 'ACTIVE'
/** Detalle público: alguna vez publicada y organización aprobada (incluye CLOSED y CANCELLED). */
export const published = (need: NeedRecord) => need.publishedAt !== null && orgOfNeed(need).verificationStatus === 'APPROVED'
/** Escritura de coordinación: quien no pertenece al equipo recibe 404, como indica el contrato. */
export function coordinated(organizationId: string, account: Account) {
  const org = findOrganization(organizationId)
  if (!membershipOf(org, account)) throw notFound()
  return org
}
/** Lectura de coordinación: equipo activo o ADMIN; el resto recibe 404. */
export const readableNeed = (id: string, account: Account) => { const need = findNeed(id); readableOrganization(causeOf(need).organizationId, account); return need }
export const coordinatedNeed = (id: string, account: Account) => { const need = findNeed(id); coordinated(causeOf(need).organizationId, account); return need }
export const isCoordination = (organizationId: string, account: Account) => teamOf(organizationId).includes(account.id)
/** Postulación visible para su autor, el equipo responsable o ADMIN; otros reciben 404. */
export function viewableApplication(id: string, account: Account) {
  const application = findApplication(id), need = needOf(application)
  const own = application.volunteerId === account.id, team = isCoordination(causeOf(need).organizationId, account)
  if (!own && !team && !account.roles.includes('ADMIN')) throw notFound()
  return { application, need, own, team }
}
export function ownApplication(id: string, account: Account) { const application = findApplication(id); if (application.volunteerId !== account.id) throw notFound(); return application }
export function teamApplication(id: string, account: Account) { const application = findApplication(id), need = needOf(application); coordinated(causeOf(need).organizationId, account); return { application, need } }
export const humanDate = (iso: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso))
export function ensureOpen(need: NeedRecord) {
  const org = orgOfNeed(need)
  if (org.verificationStatus !== 'APPROVED') throw new Fail(409, 'INVALID_TRANSITION', 'La organización no está habilitada para recibir participación en este momento.')
  if (need.status !== 'PUBLISHED') throw new Fail(409, 'INVALID_TRANSITION', 'La necesidad ya no está publicada.')
}

/* Compatibilidad explicable (sin puntuación) */
type Criterion = Schemas['MatchCriterion']
const clock = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const mark = (criterion: Criterion['criterion'], status: Criterion['status'], required: boolean, reason: string, matchedIds: string[] = [], missingIds: string[] = []): Criterion => ({ criterion, status, required, reason, matchedIds, missingIds })
function grade(matched: number, total: number): Criterion['status'] { return matched === total ? 'MATCH' : matched === 0 ? 'MISSING' : 'PARTIAL' }
export function compatibility(need: NeedRecord, account: Account): Schemas['Compatibility'] {
  const caps = capacitiesOf(account), profile = account.profile!, criteria: Criterion[] = []
  // Habilidades
  if (!need.skills.length) criteria.push(mark('SKILLS', 'NOT_APPLICABLE', false, 'Esta actividad no pide habilidades específicas.'))
  else {
    const ok = need.skills.filter(item => { const own = caps.skills.find(entry => entry.skillId === item.skillId); return own && (!item.minimumProficiency || (own.proficiency !== null && rank[own.proficiency] >= rank[item.minimumProficiency])) })
    const missing = need.skills.filter(item => !ok.includes(item)), required = need.skills.some(item => item.required), lacking = missing.filter(item => item.required).length
    const status = grade(ok.length, need.skills.length)
    criteria.push(mark('SKILLS', status, required, status === 'MATCH' ? 'Cuentas con todas las habilidades que pide la actividad.'
      : status === 'MISSING' ? 'Todavía no declaras las habilidades que pide la actividad.' : lacking ? `Te faltan ${lacking} habilidad(es) obligatoria(s) o su nivel mínimo; las demás sí las declaras.` : 'Cuentas con las habilidades obligatorias; te faltan algunas deseables.',
      ok.map(item => item.skillId), missing.map(item => item.skillId)))
  }
  // Horario: el tramo completo debe quedar cubierto por la disponibilidad semanal declarada (America/Bogota).
  const start = Date.parse(need.startsAt), end = Date.parse(need.endsAt)
  if (!caps.availability.length) criteria.push(mark('AVAILABILITY', 'MISSING', true, 'Aún no declaras tu disponibilidad semanal.'))
  else {
    let covered = 0, touched = 0, total = 0
    for (let cursor = start, guard = 0; cursor < end && guard < 15; guard++) {
      const dayStart = Math.floor((cursor - OFFSET) / DAY) * DAY + OFFSET, segmentEnd = Math.min(end, dayStart + DAY)
      const weekday = new Date(cursor - OFFSET).getUTCDay() || 7, from = (cursor - dayStart) / 60_000, to = (segmentEnd - dayStart) / 60_000
      const slots = caps.availability.filter(item => item.weekday === weekday)
      total++
      if (slots.some(item => clock(item.startsAt) <= from && clock(item.endsAt) >= to)) covered++
      else if (slots.some(item => clock(item.startsAt) < to && clock(item.endsAt) > from)) touched++
      cursor = segmentEnd
    }
    const status: Criterion['status'] = covered === total ? 'MATCH' : covered + touched === 0 ? 'MISSING' : 'PARTIAL'
    criteria.push(mark('AVAILABILITY', status, true, status === 'MATCH' ? 'Tu disponibilidad cubre todo el horario de la actividad.' : status === 'MISSING' ? 'Tu disponibilidad semanal no coincide con el horario de la actividad.' : 'Tu disponibilidad cubre solo una parte del horario de la actividad.'))
  }
  // Modalidad
  const wanted = profile.preferredModality
  if (!wanted) criteria.push(mark('MODALITY', 'MISSING', true, 'Aún no indicas tu modalidad preferida.'))
  else if (wanted === need.modality || wanted === 'HYBRID' && need.modality !== 'HYBRID') criteria.push(mark('MODALITY', 'MATCH', true, 'Tu modalidad preferida es compatible con la de la actividad.'))
  else if (need.modality === 'HYBRID') criteria.push(mark('MODALITY', 'PARTIAL', true, 'La actividad es mixta y tú prefieres una sola modalidad: podrías cubrir una parte.'))
  else criteria.push(mark('MODALITY', 'MISSING', true, 'La actividad usa una modalidad distinta de la que prefieres.'))
  // Territorio
  if (need.modality === 'REMOTE' || !need.territoryId) criteria.push(mark('TERRITORY', 'NOT_APPLICABLE', false, 'La actividad es remota: el territorio no aplica.'))
  else if (!caps.serviceAreas.length) criteria.push(mark('TERRITORY', 'MISSING', true, 'Aún no declaras las zonas donde puedes colaborar.', [], [need.territoryId]))
  else if (caps.serviceAreas.some(id => lineage(need.territoryId).includes(id))) criteria.push(mark('TERRITORY', 'MATCH', true, 'La actividad queda en una de tus zonas.', [need.territoryId]))
  else if (caps.serviceAreas.some(id => lineage(id).includes(need.territoryId!))) criteria.push(mark('TERRITORY', 'PARTIAL', true, 'Cubres una parte del territorio de la actividad.', [], [need.territoryId]))
  else criteria.push(mark('TERRITORY', 'MISSING', true, 'La actividad queda fuera de las zonas que declaras.', [], [need.territoryId]))
  // Recursos
  if (!need.resources.length) criteria.push(mark('RESOURCES', 'NOT_APPLICABLE', false, 'Esta actividad no pide recursos específicos.'))
  else {
    const ok = need.resources.filter(item => caps.resources.some(entry => entry.resourceId === item.resourceId)), missing = need.resources.filter(item => !ok.includes(item)), status = grade(ok.length, need.resources.length)
    criteria.push(mark('RESOURCES', status, need.resources.some(item => item.required), status === 'MATCH' ? 'Cuentas con los recursos que pide la actividad.' : status === 'MISSING' ? 'No declaras los recursos que pide la actividad.' : 'Cuentas con algunos de los recursos que pide la actividad.', ok.map(item => item.resourceId), missing.map(item => item.resourceId)))
  }
  return { needId: need.id, criteria, evaluatedAt: now() }
}
