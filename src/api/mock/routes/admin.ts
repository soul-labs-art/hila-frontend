import type { Schemas } from '../../client'
import { badTransition, Fail } from '../errors'
import { route } from '../router'
import { db } from '../store'
import { now, ok, paginate, sortNewest, uid } from '../util'
import { choice, text, validate } from '../validate'
import { audit, notify, teamOf } from '../domain'
import { findOrganization, requireAdmin } from '../views'

const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const
const allowed: Record<Schemas['OrganizationStatus'], Schemas['OrganizationReview']['decision'][]> = {
  PENDING: ['APPROVED', 'REJECTED', 'MORE_INFO'], APPROVED: ['SUSPENDED'], SUSPENDED: ['APPROVED'], REJECTED: [],
}

export const adminRoutes = [
  route('GET', '/admin/organizations', ({ query }) => {
    requireAdmin()
    const status = query.get('status')
    if (status !== null && !(statuses as readonly string[]).includes(status)) throw new Fail(400, 'MALFORMED_REQUEST', 'El estado indicado no es válido.')
    return ok(paginate(sortNewest(db().organizations.filter(org => !status || org.verificationStatus === status)), query) satisfies Schemas['OrganizationPage'])
  }),
  route('POST', '/admin/organizations/{organizationId}/reviews', ({ params, body }) => {
    const admin = requireAdmin(), org = findOrganization(params.organizationId)
    const data = validate<Schemas['OrganizationReview']>(body, { decision: choice(['APPROVED', 'REJECTED', 'SUSPENDED', 'MORE_INFO']), reason: text(1000) })
    if (!allowed[org.verificationStatus].includes(data.decision)) throw badTransition('Esta decisión no está disponible para el estado actual de la organización.')
    org.verificationStatus = data.decision === 'MORE_INFO' ? 'PENDING' : data.decision
    org.statusReason = data.reason; org.updatedAt = now()
    if (org.verificationStatus !== 'APPROVED') org.visibility = 'PRIVATE'
    const entry: Schemas['OrganizationVerification'] = { id: uid(), organizationId: org.id, reviewedBy: admin.id, decision: data.decision, reason: data.reason, decidedAt: now() }
    db().verifications.push(entry); audit(admin.id, `ORGANIZATION_${data.decision}`, 'ORGANIZATION', org.id)
    for (const userId of teamOf(org.id)) notify(userId, 'ORGANIZATION_REVIEWED', 'Revisaron tu organización', `${org.name}: ${data.reason}`, 'ORGANIZATION', org.id)
    return ok(entry, 201)
  }),
]
