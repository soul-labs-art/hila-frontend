// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { accountById, applicantOf, audit, causeOf, coordinated, coordinatedNeed, enumParam, ensureOpen, findNeed, findParticipation, humanDate, needOf, newest, notify, ownApplication, participationOf, published, reserved, teamApplication, teamOf, viewableApplication, findApplication, isCoordination } from '../../domain'
import { Fail, forbidden, invalid, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import { now, ok, paginate, uid } from '../../util'
import { choice, decimal, optional, validate } from '../../validate'
import { requireProfile, requireUser } from '../../views'

const applicationStates = ['APPLIED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const, commitmentStates = ['NOT_CONFIRMED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const
const conflict = (text: string) => new Fail(409, 'INVALID_TRANSITION', text)
function filters(query: URLSearchParams) { return { status: enumParam(query, 'status', applicationStates), commitment: enumParam(query, 'commitmentStatus', commitmentStates) } }
const pass = (item: Schemas['Application'], filter: ReturnType<typeof filters>) => (!filter.status || item.status === filter.status) && (!filter.commitment || item.commitmentStatus === filter.commitment)

export const participationRoutes = [
  route('POST', '/needs/{needId}/applications', ({ params, body }) => {
    const account = requireUser(), need = findNeed(params.needId), data = validate<Schemas['ApplicationCreate']>(body, { message: optional(1200) })
    if (!published(need)) throw notFound()
    requireProfile(account)
    if (db().applications.some(item => item.needId === need.id && item.volunteerId === account.id)) throw new Fail(409, 'APPLICATION_EXISTS', 'Ya te postulaste a esta actividad. Solo se permite una postulación por persona.')
    ensureOpen(need)
    if (Date.parse(need.startsAt) <= Date.now()) throw conflict('La actividad ya empezó: no se reciben más postulaciones.')
    const application: Schemas['Application'] = { id: uid(), needId: need.id, volunteerId: account.id, status: 'APPLIED', commitmentStatus: 'NOT_CONFIRMED', message: data.message, decisionReason: null, appliedAt: now(), decidedAt: null, confirmedAt: null, finishedAt: null, cancellationReason: null }
    db().applications.push(application); audit(account.id, 'APPLICATION_SUBMITTED', 'APPLICATION', application.id)
    for (const userId of teamOf(causeOf(need).organizationId)) notify(userId, 'APPLICATION_RECEIVED', 'Recibiste una postulación', `${account.displayName} se postuló a «${need.title}».`, 'APPLICATION', application.id)
    return ok(application, 201)
  }),
  route('GET', '/needs/{needId}/applications', ({ params, query }) => {
    const filter = filters(query), need = coordinatedNeed(params.needId, requireUser())
    const items = newest(db().applications.filter(item => item.needId === need.id && pass(item, filter)), item => item.appliedAt).map(item => ({ ...item, applicant: applicantOf(accountById(item.volunteerId)!) }))
    return ok(paginate(items, query) satisfies Schemas['OrganizationApplicationPage'])
  }),
  route('GET', '/me/applications', ({ query }) => {
    const account = requireUser(), filter = filters(query)
    return ok(paginate(newest(db().applications.filter(item => item.volunteerId === account.id && pass(item, filter)), item => item.appliedAt), query) satisfies Schemas['ApplicationPage'])
  }),
  route('GET', '/applications/{applicationId}', ({ params }) => ok(viewableApplication(params.applicationId, requireUser()).application satisfies Schemas['Application'])),
  route('PUT', '/applications/{applicationId}/decision', ({ params, body }) => {
    const actor = requireUser(), { application, need } = teamApplication(params.applicationId, actor), data = validate<Schemas['ApplicationDecision']>(body, { decision: choice(['ACCEPTED', 'REJECTED']), reason: optional(1000) })
    if (application.status === data.decision) return ok(application)
    if (application.status !== 'APPLIED') throw conflict('Esta postulación ya tiene otra decisión y no se puede cambiar.')
    ensureOpen(need)
    application.status = data.decision; application.decisionReason = data.reason; application.decidedAt = now(); audit(actor.id, `APPLICATION_${data.decision}`, 'APPLICATION', application.id)
    notify(application.volunteerId, 'APPLICATION_DECIDED', data.decision === 'ACCEPTED' ? 'Aceptaron tu postulación' : 'Respondieron a tu postulación',
      data.decision === 'ACCEPTED' ? `Te aceptaron en «${need.title}». Confirma tu compromiso si puedes asistir: aceptar no reserva el cupo.` : `Esta vez no seguirán con tu postulación a «${need.title}».${data.reason ? ` Motivo: ${data.reason}` : ''}`, 'APPLICATION', application.id)
    return ok(application)
  }),
  route('POST', '/applications/{applicationId}/withdrawal', ({ params }) => {
    const actor = requireUser(), application = ownApplication(params.applicationId, actor)
    if (application.commitmentStatus !== 'NOT_CONFIRMED') throw conflict('Ya confirmaste tu compromiso: cancélalo desde el compromiso en lugar de retirar la postulación.')
    if (application.status !== 'APPLIED' && application.status !== 'ACCEPTED') throw conflict('Esta postulación ya no se puede retirar.')
    application.status = 'WITHDRAWN'; application.finishedAt = now(); audit(actor.id, 'APPLICATION_WITHDRAWN', 'APPLICATION', application.id)
    return ok(application)
  }),
  route('PUT', '/applications/{applicationId}/commitment', ({ params }) => {
    const actor = requireUser(), application = ownApplication(params.applicationId, actor), need = needOf(application)
    if (application.status === 'ACCEPTED' && application.commitmentStatus === 'CONFIRMED') return ok(application)
    if (application.status !== 'ACCEPTED' || application.commitmentStatus !== 'NOT_CONFIRMED') throw conflict('Solo puedes confirmar una postulación aceptada que aún no confirmaste.')
    ensureOpen(need)
    if (Date.parse(need.startsAt) <= Date.now()) throw conflict('La actividad ya empezó: no se puede confirmar.')
    if (reserved(need.id) >= need.slotsRequired) throw new Fail(409, 'NO_SLOTS_AVAILABLE', 'Los cupos de esta actividad ya se completaron.')
    application.commitmentStatus = 'CONFIRMED'; application.confirmedAt = now(); audit(actor.id, 'COMMITMENT_CONFIRMED', 'APPLICATION', application.id)
    for (const userId of teamOf(causeOf(need).organizationId)) notify(userId, 'COMMITMENT_CONFIRMED', 'Se confirmó un compromiso', `${actor.displayName} confirmó su participación en «${need.title}» (${humanDate(need.startsAt)}).`, 'APPLICATION', application.id)
    return ok(application)
  }),
  route('POST', '/applications/{applicationId}/commitment/cancellation', ({ params, body }) => {
    const actor = requireUser(), application = findApplication(params.applicationId), need = needOf(application), own = application.volunteerId === actor.id, team = isCoordination(causeOf(need).organizationId, actor)
    if (!own && !team) throw notFound()
    const { reason } = validate<Schemas['CommitmentCancellationRequest']>(body, { reason: optional(1000) })
    if (application.commitmentStatus !== 'CONFIRMED') throw conflict('Solo se puede cancelar un compromiso confirmado que aún no se haya completado.')
    application.commitmentStatus = 'CANCELLED'; application.cancellationReason = reason; application.finishedAt = now(); audit(actor.id, 'COMMITMENT_CANCELLED', 'APPLICATION', application.id)
    const detail = reason ? ` Motivo: ${reason}` : ''
    if (own) for (const userId of teamOf(causeOf(need).organizationId).filter(id => id !== actor.id)) notify(userId, 'COMMITMENT_CANCELLED', 'Se canceló un compromiso', `${actor.displayName} canceló su participación en «${need.title}».${detail}`, 'APPLICATION', application.id)
    else notify(application.volunteerId, 'COMMITMENT_CANCELLED', 'Cancelaron tu compromiso', `La organización canceló tu participación en «${need.title}».${detail}`, 'APPLICATION', application.id)
    return ok(application)
  }),
  route('GET', '/applications/{applicationId}/activity-instructions', ({ params }) => {
    const actor = requireUser(), { application, need, team } = viewableApplication(params.applicationId, actor)
    if (!team && !actor.roles.includes('ADMIN') && application.commitmentStatus !== 'CONFIRMED' && application.commitmentStatus !== 'COMPLETED') throw forbidden()
    return ok({ needId: need.id, instructions: need.privateLocationInstructions } satisfies Schemas['ActivityInstructions'])
  }),
  route('GET', '/applications/{applicationId}/participation', ({ params }) => {
    const { application } = viewableApplication(params.applicationId, requireUser()), participation = participationOf(application)
    if (!participation) throw notFound()
    return ok(participation satisfies Schemas['Participation'])
  }),
  route('PUT', '/applications/{applicationId}/participation', ({ params, body }) => {
    const actor = requireUser(), { application, need } = teamApplication(params.applicationId, actor)
    const data = validate<Schemas['ParticipationWrite']>(body, { actualHours: decimal(0, 999.99, true), notes: optional(1200), attendance: choice(['COMPLETED', 'NO_SHOW']) })
    if (data.attendance === 'NO_SHOW' && data.actualHours !== 0) throw invalid({ field: 'actualHours', code: 'OUT_OF_RANGE', message: 'Si la persona no asistió, las horas deben ser 0.' })
    const existing = participationOf(application)
    if (existing?.status === 'VERIFIED') throw conflict('Este seguimiento ya fue verificado y no se puede modificar.')
    if (!existing && application.commitmentStatus !== 'CONFIRMED') throw conflict('Solo se registra participación de compromisos confirmados.')
    if (Date.parse(need.endsAt) > Date.now()) throw conflict('La actividad aún no termina: registra la participación después de su hora final.')
    const stamp = now(), participation: Schemas['Participation'] = existing ?? { id: uid(), applicationId: application.id, ...data, status: 'PENDING', recordedBy: actor.id, verifiedBy: null, recordedAt: stamp, verifiedAt: null }
    if (existing) Object.assign(existing, data, { status: 'PENDING', recordedBy: actor.id, recordedAt: stamp, verifiedBy: null, verifiedAt: null }); else db().participations.push(participation)
    application.commitmentStatus = data.attendance; application.finishedAt = stamp; audit(actor.id, 'PARTICIPATION_RECORDED', 'PARTICIPATION', participation.id)
    notify(application.volunteerId, 'PARTICIPATION_RECORDED', 'Registraron tu participación', `La organización registró tu ${data.attendance === 'COMPLETED' ? 'participación' : 'inasistencia'} en «${need.title}». Falta su verificación.`, 'PARTICIPATION', participation.id)
    return ok(participation)
  }),
  route('PUT', '/participation/{participationId}/verification', ({ params, body }) => {
    const actor = requireUser(), participation = findParticipation(params.participationId), application = findApplication(participation.applicationId), need = needOf(application)
    coordinated(causeOf(need).organizationId, actor)
    const data = validate<Schemas['ParticipationVerification']>(body, { decision: choice(['VERIFIED', 'DISPUTED']), reason: optional(1200) })
    if (application.volunteerId === actor.id) throw new Fail(403, 'FORBIDDEN', 'No puedes verificar tus propias horas: pide a otra persona del equipo que lo haga.')
    if (participation.status === 'VERIFIED') throw conflict('Este seguimiento ya fue verificado y no se puede modificar.')
    if (data.decision === 'VERIFIED' && participation.actualHours === null) throw invalid({ field: 'decision', code: 'REQUIRED', message: 'Registra las horas de participación antes de verificar.' })
    if (data.decision === 'DISPUTED' && !data.reason) throw invalid({ field: 'reason', code: 'REQUIRED', message: 'Cuéntanos el motivo de la disputa.' })
    const verified = data.decision === 'VERIFIED'
    participation.status = data.decision; participation.verifiedBy = verified ? actor.id : null; participation.verifiedAt = verified ? now() : null
    audit(actor.id, verified ? 'PARTICIPATION_VERIFIED' : 'PARTICIPATION_DISPUTED', 'PARTICIPATION', participation.id)
    notify(application.volunteerId, 'PARTICIPATION_VERIFIED', verified ? 'Verificaron tus horas' : 'Disputaron un registro de tu participación', verified ? `Tus horas en «${need.title}» quedaron verificadas.` : `El registro de «${need.title}» quedó en disputa. Motivo: ${data.reason}`, 'PARTICIPATION', participation.id)
    return ok(participation)
  }),
]
