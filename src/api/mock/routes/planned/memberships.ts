// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { audit } from '../../domain'
import { Fail, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import { now, ok } from '../../util'
import { choice, text, validate } from '../../validate'
import { ownedOrganization, requireUser } from '../../views'

const roles = ['ORG_OWNER', 'ORG_COORDINATOR'] as const

export const membershipRoutes = [
  route('POST', '/organizations/{organizationId}/memberships', ({ params, body }) => {
    const actor = requireUser(), org = ownedOrganization(params.organizationId, actor)
    const data = validate<Schemas['MembershipCreate']>(body, { email: text(320, { format: 'email' }), role: choice(roles) })
    const member = db().accounts.find(item => item.email === data.email.toLowerCase())
    if (!member?.verifiedAt || member.status === 'SUSPENDED') throw new Fail(422, 'MEMBER_UNAVAILABLE', 'No podemos incorporar esta cuenta. Debe existir, tener el correo verificado y estar activa.')
    if (db().memberships.some(item => item.organizationId === org.id && item.userId === member.id)) throw new Fail(409, 'MEMBERSHIP_EXISTS', 'Esta persona ya hace parte del equipo. Si fue retirada, reactívala desde el equipo.')
    const entry: Schemas['Membership'] = { organizationId: org.id, userId: member.id, displayName: member.displayName, role: data.role, status: 'ACTIVE', createdAt: now() }
    db().memberships.push(entry); audit(actor.id, 'MEMBERSHIP_CREATED', 'ORGANIZATION', org.id)
    return ok(entry, 201)
  }),
  route('PATCH', '/organizations/{organizationId}/memberships/{userId}', ({ params, body }) => {
    const actor = requireUser(), org = ownedOrganization(params.organizationId, actor)
    const entry = db().memberships.find(item => item.organizationId === org.id && item.userId === params.userId)
    if (!entry) throw notFound()
    const data = validate<Schemas['MembershipUpdate']>(body, { role: choice(roles), status: choice(['ACTIVE', 'REVOKED']) })
    const stays = data.role === 'ORG_OWNER' && data.status === 'ACTIVE'
    if (entry.role === 'ORG_OWNER' && entry.status === 'ACTIVE' && !stays && !db().memberships.some(item => item.organizationId === org.id && item !== entry && item.role === 'ORG_OWNER' && item.status === 'ACTIVE'))
      throw new Fail(409, 'LAST_OWNER_REQUIRED', 'La organización necesita al menos una persona dueña activa. Asigna ese rol a otra persona antes de continuar.')
    Object.assign(entry, data); audit(actor.id, 'MEMBERSHIP_UPDATED', 'ORGANIZATION', org.id)
    return ok(entry)
  }),
]
