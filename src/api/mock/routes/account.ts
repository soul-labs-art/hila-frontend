import type { Schemas } from '../../client'
import { Fail } from '../errors'
import { receiveImage, slotOf } from '../images'
import { route } from '../router'
import { policies } from '../seed'
import { noContent, now, ok } from '../util'
import { choice, flag, optional, text, validate } from '../validate'
import { requireProfile, requireUser, toUser } from '../views'

const modalities = ['IN_PERSON', 'REMOTE', 'HYBRID'] as const

export const accountRoutes = [
  route('GET', '/me', () => ok(toUser(requireUser()))),
  route('PATCH', '/me', ({ body }) => {
    const account = requireUser()
    account.displayName = validate<Schemas['AccountUpdate']>(body, { displayName: text(140) }).displayName
    return ok(toUser(account))
  }),
  route('GET', '/me/consents', () => ok(requireUser().consents satisfies Schemas['Consent'][])),
  route('PUT', '/me/opportunity-alerts', ({ body }) => {
    const account = requireUser(), profile = requireProfile(account)
    const data = validate<Schemas['OpportunityAlertsUpdate']>(body, { enabled: flag(), policyVersion: text(40) })
    const policy = policies.find(item => item.type === 'OPPORTUNITY_ALERTS')!
    if (data.enabled && data.policyVersion !== policy.version) throw new Fail(409, 'POLICY_VERSION_OUTDATED', 'La política de avisos cambió. Léela de nuevo antes de continuar.')
    const stamp = now(), active = account.consents.find(item => item.type === 'OPPORTUNITY_ALERTS' && !item.revokedAt)
    if (data.enabled && !active) account.consents.push({ type: 'OPPORTUNITY_ALERTS', version: data.policyVersion, acceptedAt: stamp, revokedAt: null })
    if (!data.enabled && active) active.revokedAt = stamp
    profile.emailOpportunityAlerts = data.enabled
    account.alerts = { enabled: data.enabled, policyVersion: data.policyVersion, updatedAt: stamp }
    return ok(account.alerts)
  }),
  route('GET', '/me/volunteer-profile', () => ok(requireProfile(requireUser()))),
  route('PUT', '/me/volunteer-profile', ({ body }) => {
    const account = requireUser()
    const data = validate<Schemas['VolunteerProfileUpdate']>(body, { biography: optional(1200), profession: optional(140), educationLevel: optional(80), preferredModality: choice(modalities, true) })
    const stamp = now()
    account.profile = account.profile ? { ...account.profile, ...data, updatedAt: stamp }
      : { userId: account.id, ...data, emailOpportunityAlerts: false, createdAt: stamp, updatedAt: stamp, visibility: 'PRIVATE', avatar: null, cover: null }
    return ok(account.profile)
  }),
  route('PUT', '/me/volunteer-profile/publication', ({ body }) => {
    const profile = requireProfile(requireUser())
    profile.visibility = validate<Schemas['PublicationRequest']>(body, { visible: flag() }).visible ? 'PUBLIC' : 'PRIVATE'; profile.updatedAt = now()
    return ok(profile)
  }),
  route('PUT', '/me/volunteer-profile/images/{slot}', async ({ params, form }) => {
    const profile = requireProfile(requireUser()), slot = slotOf(params.slot)
    profile[slot] = await receiveImage(form); profile.updatedAt = now()
    return ok(profile[slot])
  }),
  route('DELETE', '/me/volunteer-profile/images/{slot}', ({ params }) => {
    const profile = requireProfile(requireUser()), slot = slotOf(params.slot)
    profile[slot] = null; profile.updatedAt = now()
    return noContent()
  }),
]
