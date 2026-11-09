import type { Schemas } from '../../client'
import { badTransition, forbidden, invalid } from '../errors'
import { receiveImage, slotOf } from '../images'
import { route } from '../router'
import { db } from '../store'
import { noContent, now, ok, paginate, sortNewest, uid } from '../util'
import { choice, flag, optional, text, validate } from '../validate'
import { membershipOf, ownedOrganization, readableOrganization, requireUser, territoryById } from '../views'

const write = () => ({ name: text(180), organizationType: choice(['FORMAL', 'COLLECTIVE']), legalIdentifier: optional(40), description: text(2000), verificationContext: optional(2000),
  publicEmail: optional(320, { format: 'email' }), publicWebsite: optional(500, { format: 'uri' }), serviceTerritoryId: optional(36, { format: 'uuid' }) })
function organizationData(body: unknown) {
  const data = validate<Schemas['OrganizationWrite']>(body, write()), errors: Schemas['FieldError'][] = []
  if (data.organizationType === 'FORMAL' && !data.legalIdentifier) errors.push({ field: 'legalIdentifier', code: 'REQUIRED', message: 'Escribe el NIT o identificador legal.' })
  if (data.organizationType === 'COLLECTIVE' && !data.verificationContext) errors.push({ field: 'verificationContext', code: 'REQUIRED', message: 'Cuéntanos la trayectoria y las referencias del colectivo.' })
  if (data.serviceTerritoryId && !territoryById(data.serviceTerritoryId)?.active) errors.push({ field: 'serviceTerritoryId', code: 'INVALID_REFERENCE', message: 'Elige un territorio de la lista.' })
  if (errors.length) throw invalid(...errors)
  return data
}
const record = (organizationId: string, decision: Schemas['OrganizationVerification']['decision'], reason: string | null, reviewedBy: string | null = null): Schemas['OrganizationVerification'] =>
  ({ id: uid(), organizationId, reviewedBy, decision, reason, decidedAt: now() })
const history = (organizationId: string) => db().verifications.filter(item => item.organizationId === organizationId).reverse().sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
const latestDecision = (organizationId: string) => history(organizationId)[0]?.decision

export const organizationRoutes = [
  route('GET', '/me/organizations', ({ query }) => {
    const account = requireUser()
    return ok(paginate(sortNewest(db().organizations.filter(org => membershipOf(org, account))), query) satisfies Schemas['OrganizationPage'])
  }),
  route('POST', '/organizations', ({ body }) => {
    const account = requireUser(), data = organizationData(body), stamp = now()
    const org: Schemas['Organization'] = { ...data, id: uid(), verificationStatus: 'PENDING', statusReason: null, createdBy: account.id, createdAt: stamp, updatedAt: stamp, visibility: 'PRIVATE', avatar: null, cover: null }
    db().organizations.push(org)
    db().memberships.push({ organizationId: org.id, userId: account.id, displayName: account.displayName, role: 'ORG_OWNER', status: 'ACTIVE', createdAt: stamp })
    db().verifications.push(record(org.id, 'SUBMITTED', null))
    return ok(org, 201)
  }),
  route('GET', '/organizations/{organizationId}', ({ params }) => ok(readableOrganization(params.organizationId, requireUser()))),
  route('PUT', '/organizations/{organizationId}', ({ params, body }) => {
    const org = ownedOrganization(params.organizationId, requireUser()), data = organizationData(body)
    if (org.verificationStatus === 'APPROVED' && (data.organizationType !== org.organizationType || data.legalIdentifier !== org.legalIdentifier)) throw badTransition('El tipo de organización y el NIT no se pueden cambiar después de la aprobación.')
    Object.assign(org, data, { updatedAt: now() })
    return ok(org)
  }),
  route('POST', '/organizations/{organizationId}/verification-requests', ({ params, body }) => {
    const org = ownedOrganization(params.organizationId, requireUser())
    const { context } = validate<Schemas['VerificationSubmission']>(body, { context: text(2000) })
    if (org.verificationStatus === 'SUSPENDED') throw forbidden()
    if (!(org.verificationStatus === 'REJECTED' || (org.verificationStatus === 'PENDING' && latestDecision(org.id) === 'MORE_INFO'))) throw badTransition('Esta organización no necesita enviar información adicional ahora.')
    org.verificationStatus = 'PENDING'; org.verificationContext = context; org.updatedAt = now()
    const entry = record(org.id, 'SUBMITTED', null)
    db().verifications.push(entry)
    return ok(entry, 201)
  }),
  route('GET', '/organizations/{organizationId}/verifications', ({ params, query }) => {
    const org = readableOrganization(params.organizationId, requireUser())
    return ok(paginate(history(org.id), query) satisfies Schemas['OrganizationVerificationPage'])
  }),
  route('GET', '/organizations/{organizationId}/memberships', ({ params, query }) => {
    const org = readableOrganization(params.organizationId, requireUser())
    return ok(paginate(db().memberships.filter(item => item.organizationId === org.id), query) satisfies Schemas['MembershipPage'])
  }),
  route('PUT', '/organizations/{organizationId}/publication', ({ params, body }) => {
    const org = ownedOrganization(params.organizationId, requireUser())
    const { visible } = validate<Schemas['PublicationRequest']>(body, { visible: flag() })
    if (visible && org.verificationStatus !== 'APPROVED') throw badTransition('La organización necesita aprobación de Hila antes de publicar su perfil.')
    org.visibility = visible ? 'PUBLIC' : 'PRIVATE'; org.updatedAt = now()
    return ok(org)
  }),
  route('PUT', '/organizations/{organizationId}/images/{slot}', async ({ params, form }) => {
    const org = ownedOrganization(params.organizationId, requireUser()), slot = slotOf(params.slot)
    org[slot] = await receiveImage(form); org.updatedAt = now()
    return ok(org[slot])
  }),
  route('DELETE', '/organizations/{organizationId}/images/{slot}', ({ params }) => {
    const org = ownedOrganization(params.organizationId, requireUser()), slot = slotOf(params.slot)
    org[slot] = null; org.updatedAt = now()
    return noContent()
  }),
]