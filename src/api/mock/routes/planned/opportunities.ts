// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { audit, capacitiesOf, catalogErrors, causeOf, compatibility, coordinated, coordinatedNeed, dateParam, enumParam, findCause, humanDate, idParam, interested, lineage, listed, managedView, matches, newest, notify, ordered, orgOfNeed, publicView, published, readableNeed, reserved, teamOf, uuid } from '../../domain'
import { Fail, invalid, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { FieldError, NeedRecord } from '../../types'
import { now, ok, paginate, uid } from '../../util'
import { choice, flag, list, optional, text, validate, whole } from '../../validate'
import { readableOrganization, requireProfile, requireUser, territoryById } from '../../views'
import { modalities, proficiencies, rows } from './common'

const causeStates = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const, needStates = ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'] as const
const causeRules = () => ({ title: text(180), summary: text(500), description: optional(10000), status: choice(causeStates) })
const needRules = () => ({ title: text(180), summary: text(500), description: text(10000), expectedOutcome: text(1000), modality: choice(modalities), riskLevel: choice(['LOW', 'MODERATE']),
  startsAt: text(40, { format: 'datetime' }), endsAt: text(40, { format: 'datetime' }), timezone: choice(['America/Bogota']), territoryId: optional(36, { format: 'uuid' }), publicLocationLabel: optional(180), conditions: optional(10000),
  slotsRequired: whole(1, 32767), privateLocationInstructions: optional(1000), skills: list(100), resources: list(100) })
const conflict = (text: string) => new Fail(409, 'INVALID_TRANSITION', text)
const wrongDate = (field: string, message: string): FieldError => ({ field, code: 'OUT_OF_RANGE', message })

function needInput(body: unknown, previous?: NeedRecord) {
  const raw = validate<Omit<Schemas['NeedWrite'], 'skills' | 'resources'> & { skills: unknown[]; resources: unknown[] }>(body, needRules())
  const skills = rows<Schemas['NeedSkillInput']>(raw.skills, 'skills', { skillId: text(36, { format: 'uuid' }), required: flag(), minimumProficiency: choice(proficiencies, true) })
  const resources = rows<Schemas['NeedResourceInput']>(raw.resources, 'resources', { resourceId: text(36, { format: 'uuid' }), required: flag(), details: optional(280) })
  const errors: FieldError[] = []
  if (Date.parse(raw.endsAt) <= Date.parse(raw.startsAt)) errors.push(wrongDate('endsAt', 'La hora de cierre debe ser posterior a la de inicio.'))
  if (raw.modality !== 'REMOTE' && !raw.territoryId) errors.push({ field: 'territoryId', code: 'REQUIRED', message: 'Elige el territorio de la actividad: solo las remotas pueden omitirlo.' })
  if (raw.territoryId) {
    const territory = territoryById(raw.territoryId)
    if (!territory) errors.push({ field: 'territoryId', code: 'INVALID_REFERENCE', message: 'Elige un territorio de la lista.' })
    else if (!territory.active && previous?.territoryId !== territory.id) errors.push({ field: 'territoryId', code: 'INACTIVE_REFERENCE', message: 'Este territorio ya no está disponible.' })
  }
  errors.push(...catalogErrors(db().skills, skills.map(item => item.skillId), index => `skills[${index}].skillId`, previous?.skills.map(item => item.skillId)))
  errors.push(...catalogErrors(db().resources, resources.map(item => item.resourceId), index => `resources[${index}].resourceId`, previous?.resources.map(item => item.resourceId)))
  if (errors.length) throw invalid(...errors)
  return { ...raw, startsAt: new Date(raw.startsAt).toISOString(), endsAt: new Date(raw.endsAt).toISOString(), skills, resources }
}
const ofCause = (organizationId: string, causeId?: string) => db().causes.filter(item => item.organizationId === organizationId && (!causeId || item.id === causeId))
const rankOf = (status: Schemas['Cause']['status']) => causeStates.indexOf(status)

export const opportunityRoutes = [
  route('GET', '/organizations/{organizationId}/causes', ({ params, query }) => {
    const org = readableOrganization(params.organizationId, requireUser())
    return ok(paginate(newest(ofCause(org.id), item => item.createdAt), query) satisfies Schemas['CausePage'])
  }),
  route('POST', '/organizations/{organizationId}/causes', ({ params, body }) => {
    const actor = requireUser(), org = coordinated(params.organizationId, actor), data = validate<Schemas['CauseWrite']>(body, causeRules())
    if (data.status === 'ARCHIVED') throw invalid({ field: 'status', code: 'INVALID_FORMAT', message: 'Una causa nueva comienza en borrador o activa.' })
    if (data.status === 'ACTIVE' && org.verificationStatus !== 'APPROVED') throw conflict('La organización necesita aprobación de Hila para activar causas. Puedes guardarla como borrador.')
    const stamp = now(), cause: Schemas['Cause'] = { id: uid(), organizationId: org.id, ...data, createdBy: actor.id, createdAt: stamp, updatedAt: stamp }
    db().causes.push(cause); audit(actor.id, 'CAUSE_CREATED', 'CAUSE', cause.id)
    return ok(cause, 201)
  }),
  route('GET', '/causes/{causeId}', ({ params }) => { const cause = findCause(params.causeId); readableOrganization(cause.organizationId, requireUser()); return ok(cause satisfies Schemas['Cause']) }),
  route('PUT', '/causes/{causeId}', ({ params, body }) => {
    const actor = requireUser(), cause = findCause(params.causeId), org = coordinated(cause.organizationId, actor), data = validate<Schemas['CauseWrite']>(body, causeRules())
    if (rankOf(data.status) < rankOf(cause.status)) throw conflict('Una causa no puede volver a un estado anterior: va de borrador a activa y de activa a archivada.')
    if (data.status !== cause.status && data.status === 'ACTIVE' && org.verificationStatus !== 'APPROVED') throw conflict('La organización necesita aprobación de Hila para activar causas.')
    if (data.status === 'ARCHIVED' && cause.status !== 'ARCHIVED' && db().needs.some(item => item.causeId === cause.id && item.status === 'PUBLISHED')) throw conflict('Cancela o cierra las necesidades publicadas antes de archivar la causa.')
    Object.assign(cause, data, { updatedAt: now() }); audit(actor.id, 'CAUSE_UPDATED', 'CAUSE', cause.id)
    return ok(cause)
  }),
  route('GET', '/causes/{causeId}/needs', ({ params, query }) => {
    const cause = findCause(params.causeId), status = enumParam(query, 'status', needStates)
    readableOrganization(cause.organizationId, requireUser())
    return ok(paginate(newest(db().needs.filter(item => item.causeId === cause.id && (!status || item.status === status)), item => item.createdAt).map(managedView), query) satisfies Schemas['ManagedNeedPage'])
  }),
  route('POST', '/causes/{causeId}/needs', ({ params, body }) => {
    const actor = requireUser(), cause = findCause(params.causeId)
    coordinated(cause.organizationId, actor)
    if (cause.status === 'ARCHIVED') throw conflict('La causa está archivada: no admite necesidades nuevas.')
    const stamp = now(), need: NeedRecord = { ...needInput(body), id: uid(), causeId: cause.id, status: 'DRAFT', publishedAt: null, closedAt: null, outcome: null, updatedAt: stamp, createdBy: actor.id, createdAt: stamp }
    db().needs.push(need); audit(actor.id, 'NEED_CREATED', 'NEED', need.id)
    return ok(managedView(need), 201)
  }),
  route('GET', '/needs', ({ query }) => {
    const q = query.get('q'), territory = idParam(query, 'territoryId'), modality = enumParam(query, 'modality', modalities), skill = idParam(query, 'skillId'), from = dateParam(query, 'startsFrom'), to = dateParam(query, 'startsTo')
    ordered(from, to, 'startsFrom')
    const items = db().needs.filter(item => listed(item) && (!q || matches(item.title, q) || matches(item.summary, q)) && (!territory || lineage(item.territoryId).includes(territory)) && (!modality || item.modality === modality)
      && (!skill || item.skills.some(entry => entry.skillId === skill)) && (from === null || Date.parse(item.startsAt) >= from) && (to === null || Date.parse(item.startsAt) <= to))
    return ok(paginate([...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)).map(publicView), query) satisfies Schemas['PublicNeedPage'])
  }),
  route('GET', '/needs/{needId}', ({ params }) => {
    const need = db().needs.find(item => item.id === uuid(params.needId))
    if (!need || !published(need)) throw notFound()
    return ok(publicView(need) satisfies Schemas['PublicNeed'])
  }),
  route('GET', '/needs/{needId}/management', ({ params }) => ok(managedView(readableNeed(params.needId, requireUser())) satisfies Schemas['ManagedNeed'])),
  route('PUT', '/needs/{needId}/management', ({ params, body }) => {
    const actor = requireUser(), need = coordinatedNeed(params.needId, actor)
    if (need.status !== 'DRAFT' && need.status !== 'PUBLISHED') throw conflict('Solo se pueden editar necesidades en borrador o publicadas.')
    if (need.status === 'PUBLISHED' && orgOfNeed(need).verificationStatus !== 'APPROVED') throw conflict('La organización no está aprobada: no puedes modificar necesidades publicadas.')
    const data = needInput(body, need), held = reserved(need.id)
    if (data.slotsRequired < held) throw invalid({ field: 'slotsRequired', code: 'OUT_OF_RANGE', message: `Ya hay ${held} cupo(s) reservado(s): no puedes bajar de ese número.` })
    const fixed = (['startsAt', 'endsAt', 'modality', 'territoryId'] as const).some(key => data[key] !== need[key])
    if (fixed && db().applications.some(item => item.needId === need.id && item.commitmentStatus === 'CONFIRMED')) throw conflict('Con compromisos confirmados no se pueden cambiar el horario, la modalidad ni el territorio. Cancela la actividad y crea otra.')
    const relevant = fixed || (['title', 'publicLocationLabel', 'privateLocationInstructions'] as const).some(key => data[key] !== need[key])
    Object.assign(need, data, { updatedAt: now() }); audit(actor.id, 'NEED_UPDATED', 'NEED', need.id)
    if (need.status === 'PUBLISHED' && relevant) for (const userId of interested(need.id)) notify(userId, 'NEED_UPDATED', 'Cambió una actividad a la que te postulaste', `«${need.title}» tiene cambios. Ahora empieza el ${humanDate(need.startsAt)}. Revisa los detalles.`, 'NEED', need.id)
    return ok(managedView(need))
  }),
  route('POST', '/needs/{needId}/publication', ({ params }) => {
    const actor = requireUser(), need = coordinatedNeed(params.needId, actor), org = orgOfNeed(need)
    if (need.status !== 'DRAFT') throw conflict('Solo se puede publicar una necesidad en borrador.')
    if (causeOf(need).status !== 'ACTIVE') throw conflict('La causa debe estar activa para publicar sus necesidades.')
    if (org.verificationStatus !== 'APPROVED') throw conflict('La organización necesita aprobación de Hila antes de publicar.')
    if (Date.parse(need.startsAt) <= Date.now()) throw invalid({ field: 'startsAt', code: 'OUT_OF_RANGE', message: 'El inicio debe estar en el futuro para publicar.' })
    need.status = 'PUBLISHED'; need.publishedAt = now(); need.updatedAt = now(); audit(actor.id, 'NEED_PUBLISHED', 'NEED', need.id)
    // Avisos de nuevas oportunidades: solo con consentimiento activo y compatibilidad básica (modalidad y territorio).
    for (const account of db().accounts) {
      if (!account.profile?.emailOpportunityAlerts || teamOf(org.id).includes(account.id) || account.status === 'SUSPENDED') continue
      capacitiesOf(account)
      const basic = compatibility(need, account).criteria.filter(item => item.criterion === 'MODALITY' || item.criterion === 'TERRITORY')
      if (basic.every(item => item.status !== 'MISSING')) notify(account.id, 'NEW_OPPORTUNITY', 'Hay una actividad que podría interesarte', `${org.name} publicó «${need.title}». Revisa si se ajusta a tu tiempo.`, 'NEED', need.id)
    }
    return ok(managedView(need))
  }),
  route('POST', '/needs/{needId}/cancellation', ({ params, body }) => {
    const actor = requireUser(), need = coordinatedNeed(params.needId, actor), { reason } = validate<Schemas['ReasonRequest']>(body, { reason: text(1000) })
    if (need.status !== 'DRAFT' && need.status !== 'PUBLISHED') throw conflict('Esta necesidad ya está cerrada o cancelada.')
    const recipients = interested(need.id), stamp = now()
    for (const item of db().applications.filter(entry => entry.needId === need.id && entry.commitmentStatus === 'CONFIRMED')) { item.commitmentStatus = 'CANCELLED'; item.cancellationReason = reason; item.finishedAt = stamp }
    need.status = 'CANCELLED'; need.updatedAt = stamp; audit(actor.id, 'NEED_CANCELLED', 'NEED', need.id)
    for (const userId of recipients) notify(userId, 'NEED_CANCELLED', 'Se canceló una actividad', `«${need.title}» fue cancelada. Motivo: ${reason}`, 'NEED', need.id)
    return ok(managedView(need))
  }),
  route('PUT', '/needs/{needId}/outcome', ({ params, body }) => {
    const actor = requireUser(), need = coordinatedNeed(params.needId, actor), data = validate<Schemas['CloseNeedRequest']>(body, { outcomeStatus: choice(['FULFILLED', 'PARTIAL', 'NOT_FULFILLED']), summary: text(2000) })
    if (need.status !== 'PUBLISHED') throw conflict(need.status === 'CLOSED' ? 'El resultado de esta necesidad ya quedó registrado y no se puede cambiar.' : 'Solo se pueden cerrar necesidades publicadas.')
    if (Date.parse(need.endsAt) > Date.now()) throw conflict('La actividad aún no termina: ciérrala después de su hora final.')
    if (db().applications.some(item => item.needId === need.id && item.commitmentStatus === 'CONFIRMED')) throw conflict('Hay compromisos confirmados sin participación registrada. Regístralos antes de cerrar.')
    const stamp = now()
    need.status = 'CLOSED'; need.closedAt = stamp; need.updatedAt = stamp; need.outcome = { status: data.outcomeStatus, summary: data.summary, verifiedBy: actor.id, verifiedAt: stamp }
    audit(actor.id, 'NEED_CLOSED', 'NEED', need.id)
    for (const userId of interested(need.id)) notify(userId, 'NEED_CLOSED', 'Se cerró una actividad', `«${need.title}» se cerró con resultado registrado por la organización.`, 'NEED', need.id)
    return ok(managedView(need))
  }),
  route('GET', '/needs/{needId}/compatibility', ({ params }) => {
    const account = requireUser()
    requireProfile(account)
    const need = db().needs.find(item => item.id === uuid(params.needId))
    if (!need || !listed(need)) throw notFound()
    return ok(compatibility(need, account) satisfies Schemas['Compatibility'])
  }),
]
