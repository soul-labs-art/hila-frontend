// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { audit, causeOf, findApplication, isCoordination, needOf, newest, participationOf } from '../../domain'
import { Fail, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { Account } from '../../types'
import { now, ok, uid } from '../../util'
import { optional, validate, whole } from '../../validate'
import { requireUser } from '../../views'

/** El autor es quien se postuló (evalúa a la organización) o el equipo responsable (evalúa a la persona voluntaria). */
function parties(applicationId: string, account: Account) {
  const application = findApplication(applicationId), organizationId = causeOf(needOf(application)).organizationId
  const own = application.volunteerId === account.id, team = !own && isCoordination(organizationId, account)
  return { application, organizationId, own, team, admin: account.roles.includes('ADMIN') }
}

export const feedbackRoutes = [
  route('POST', '/applications/{applicationId}/feedback', ({ params, body }) => {
    const actor = requireUser(), { application, organizationId, own, team } = parties(params.applicationId, actor)
    if (!own && !team) throw notFound()
    const data = validate<Schemas['FeedbackCreate']>(body, { rating: whole(1, 5), comment: optional(1200) }), participation = participationOf(application)
    if (!(application.commitmentStatus === 'COMPLETED' || application.commitmentStatus === 'NO_SHOW') || participation?.status !== 'VERIFIED') throw new Fail(409, 'INVALID_TRANSITION', 'El feedback se envía cuando la participación ya fue verificada.')
    if (db().feedback.some(item => item.applicationId === application.id && item.authorUserId === actor.id)) throw new Fail(409, 'INVALID_TRANSITION', 'Ya enviaste tu feedback para esta postulación y no se puede modificar.')
    const entry: Schemas['Feedback'] = { id: uid(), applicationId: application.id, authorUserId: actor.id, targetUserId: own ? null : application.volunteerId, targetOrganizationId: own ? organizationId : null, ...data, createdAt: now() }
    db().feedback.push(entry); audit(actor.id, 'FEEDBACK_SUBMITTED', 'APPLICATION', application.id)
    return ok(entry, 201)
  }),
  route('GET', '/applications/{applicationId}/feedback', ({ params }) => {
    const actor = requireUser(), { application, own, team, admin } = parties(params.applicationId, actor)
    if (!own && !team && !admin) throw notFound()
    // Quien se postuló solo ve lo que escribió; el equipo responsable y ADMIN ven todas las entradas de la postulación.
    return ok(newest(db().feedback.filter(item => item.applicationId === application.id && (!own || item.authorUserId === actor.id)), item => item.createdAt) satisfies Schemas['Feedback'][])
  }),
]
